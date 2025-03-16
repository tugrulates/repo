/**
 * Interact with Lonely Planet, the travel guide website.
 *
 * @example Search Lonely Planet through the API client.
 * ```ts
 * import { lonelyPlanet } from "@tugrulates/lonely-planet";
 *
 * async function usage() {
 *   const api = lonelyPlanet();
 *   for await (const destination of api.destinations(["big sur"])) {
 *     console.log(destination.title);
 *   }
 * }
 * ```
 *
 * @example Search Lonely Planet through the command-line application.
 * ```sh
 * deno run -N jsr:@tugrulates/lonely-planet big sur
 * ``
 *
 * @module lonely-planet
 */

import { DOMParser } from "@b-fuze/deno-dom";
import { pool } from "@roka/async/pool";
import { client } from "@roka/http/json/client";
import { toPascalCase } from "@std/text";

/**
 * A Lonely Planet API client returned from the {@linkcode lonelyPlanet}
 * function.
 */
export interface LonelyPlanet {
  /** Returns Lonely Planet destinations matching the given keywords. */
  destinations(keywords: string[]): AsyncIterable<Destination>;
  /** Returns Lonely Planet attractions matching the given keywords. */
  attractions(keywords: string[]): AsyncIterable<Attraction>;
  /** Returns Lonely Planet stories matching the given keywords. */
  stories(keywords: string[]): AsyncIterable<Story>;
}

/** A Lonely Planet document. */
export interface Document {
  /** Document ID. */
  id: string;
  /** Document URL. */
  slug: string;
  /** Document title. */
  title: string;
  /** Summary for topic of the document. */
  excerpt: string;
  /** Document image. */
  featuredImage: Image;
}

/** A Lonely Planet destination type. */
export type DestinationType =
  | "Continent"
  | "Country"
  | "Region"
  | "City"
  | "Neighborhood";

/** A Lonely Planet destination. */
export interface Destination extends Document {
  /** Destination type. */
  type: DestinationType;
  /** Global breadcrumb to the location. */
  breadcrumb: Breadcrumb[];
}

/** A Lonely Planet attraction type. */
export type AttractionType = "Attractions";

/** A Lonely Planet attraction. */
export interface Attraction extends Document {
  /** Attraction type. */
  type: AttractionType;
  /** Global breadcrumb to the location. */
  breadcrumb: Breadcrumb[];
}

/** A Lonely Planet story type. */
export type StoryType = "Feature" | "News";

/** A Lonely Planet story. */
export interface Story extends Document {
  /** Story type. */
  type: StoryType;
  /** Story publication date in ISO string. */
  date: string;
  /** Story read time in minutes. */
  readTime: number;
}

/** Global path component of a Lonely Planet document. */
export interface Breadcrumb {
  /** Node URL. */
  slug: string;
  /** Node title. */
  title: string;
  /** Node type. */
  type: DestinationType | AttractionType;
}

/** A Lonely Planet image. */
export interface Image {
  /** Alt text for the image. */
  alt: string;
  /** Caption for the image. */
  caption: string;
  /** Image credit. */
  credit: string;
  /** Image width in pixels. */
  width: number;
  /** Image height in pixels. */
  height: number;
  /** Image title. */
  title: string;
  /** Image URL. */
  url: string;
}

/** A results page for a query on the Lonely Planet. */
interface Results {
  hits: [{ document: Destination | Attraction | Story }];
}

/** Typesense credentials for the Lonely Planet data. */
interface Typesense {
  endpoint: string;
  token: string;
}

/** A Typesense server error. */
interface Error {
  code: number;
  error: string;
}

/** Creates a Lonely Planet API client. */
export function lonelyPlanet(): LonelyPlanet {
  let ts: Typesense;
  return {
    async *destinations(keywords: string[]): AsyncGenerator<Destination> {
      if (!ts) ts = await typesense();
      for await (
        const document of search<Destination>(ts, "places", keywords)
      ) {
        yield document as Destination;
      }
    },
    async *attractions(keywords: string[]): AsyncGenerator<Attraction> {
      if (!ts) ts = await typesense();
      for await (const document of search<Attraction>(ts, "pois", keywords)) {
        yield document as Attraction;
      }
    },
    async *stories(keywords: string[]): AsyncGenerator<Story> {
      if (!ts) ts = await typesense();
      for await (const document of search<Story>(ts, "articles", keywords)) {
        yield document as Story;
      }
    },
  };
}

async function typesense(): Promise<Typesense> {
  const concurrency = 4;
  const site = "https://www.lonelyplanet.com";
  const pattern =
    /{server:{apiKey:"([^"]+)",nodes:\[{host:"".concat\("([^"]+)"\),port:"(\d+)",protocol:"(\w+)"}\]/;
  const response = await fetch(site);
  if (!response.ok) throw new Error("Failed to fetch homepage");
  const doc = new DOMParser().parseFromString(
    await response.text(),
    "text/html",
  );
  const result = await pool(
    doc.querySelector("head")?.querySelectorAll("script") ?? [],
    async (script) => {
      const src = script.attributes.getNamedItem("src")?.value;
      if (!src || !/webpack/.test(src)) return [];
      const response = await fetch(new URL(src, site));
      if (!response.ok) throw new Error(`Failed to fetch webpack script`);
      const source = await response.text();
      const chunks = await pool(
        source.matchAll(/"(static\/chunks\/[^"]+?\.js)"/g),
        async (chunk) => {
          const response = await fetch(new URL(`/_next/${chunk[1]}`, site));
          if (!response.ok) throw new Error(`Failed to fetch next script`);
          return await response.text();
        },
        { concurrency },
      );
      for (const script of chunks) {
        const [, token, host, port, protocol] = pattern.exec(script) ?? [];
        if (token && host) {
          return [{
            endpoint: `${protocol ?? "https"}://${host}${
              port ? `:${port}` : ""
            }`,
            token,
          }];
        }
      }
    },
    { concurrency },
  );
  const [typesense] = result.flat();
  if (!typesense) throw new Error("Typesense details not found");
  return typesense;
}

async function* search<T extends Destination | Attraction | Story>(
  typesense: Typesense,
  collection: "places" | "pois" | "articles",
  keywords: string[],
): AsyncGenerator<T> {
  const { endpoint, token } = typesense;
  const api = client(endpoint);
  let page = 1;
  while (true) {
    const preset = `global_search_${collection}`;
    const q = keywords.join(" ");
    const body = { searches: [{ preset, collection, q, per_page: 100, page }] };
    // deno-lint-ignore no-await-in-loop
    const results = (await api.post<{ results: (Results | Error)[] }>(
      `/multi_search?x-typesense-api-key=${token}`,
      body,
    )).results;
    if (!results || !results[0]) break;
    if ("error" in results[0]) {
      throw new Error(results[0].error);
    } else if ("hits" in results[0]) {
      for (const hit of results[0].hits) {
        const document = hit.document;
        let type = toPascalCase(document.type);
        if (type === "" && "breadcrumb" in document) {
          const parentType = document.breadcrumb.at(-1)?.type;
          if (parentType === "Continent") type = "Country";
          else if (parentType === "Country") type = "Region";
        }
        yield { ...document, type } as T;
      }
      if (!results[0].hits.length) break;
      page++;
    } else {
      break;
    }
  }
}
