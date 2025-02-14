import { DOMParser } from "@b-fuze/deno-dom";
import { JsonClient } from "@roka/http/json";
import { toPascalCase } from "@std/text";
import type { Attraction, Destination, Story } from "./types.ts";

const SITE = "https://www.lonelyplanet.com";
const TYPESENSE_PATTERN =
  /{server:{apiKey:"([^"]+)",nodes:\[{host:"".concat\("([^"]+)"\),port:"(\d+)",protocol:"(\w+)"}\]/;

/** A results page for a query on the Lonely Planet. */
interface Results {
  hits: [{ document: Destination | Attraction | Story }];
}

/** Typesense credentials for the Lonely Planet corpus. */
interface Typesense {
  endpoint: string;
  token: string;
}

/** A Typesense server error. */
interface Error {
  code: number;
  error: string;
}

/**
 * Client for interacting with the Lonely Planet API.
 */
export class LonelyPlanetClient {
  private typesense?: Typesense = undefined;

  /**
   * Searches Lonely Planet for destinations with the given keywords.
   *
   * @param keywords The keywords to search for.
   * @returns Generator for the search results.
   */
  async *searchDestinations(keywords: string[]): AsyncGenerator<Destination> {
    for await (
      const document of this.search<Destination>("places", keywords)
    ) {
      yield document as Destination;
    }
  }

  /**
   * Searches Lonely Planet for attractions with the given keywords.
   *
   * @param keywords The keywords to search for.
   * @returns Generator for the search results.
   */
  async *searchAttractions(keywords: string[]): AsyncGenerator<Attraction> {
    for await (const document of this.search<Attraction>("pois", keywords)) {
      yield document as Attraction;
    }
  }

  /**
   * Searches Lonely Planet for stories with the given keywords.
   *
   * @param keywords The keywords to search for.
   * @returns Generator for the search results.
   */
  async *searchStories(keywords: string[]): AsyncGenerator<Story> {
    for await (const document of this.search<Story>("articles", keywords)) {
      yield document as Story;
    }
  }

  /**
   * Searches Lonely Planet for the given keywords.
   *
   * @template T The type of document to search for.
   * @param collection The collection to search.
   * @param keywords The keywords to search for.
   * @returns Generator for the search results.
   */
  private async *search<T extends Destination | Attraction | Story>(
    collection: "places" | "pois" | "articles",
    keywords: string[],
  ): AsyncGenerator<T> {
    let page = 1;
    while (true) {
      const body = {
        searches: [{
          preset: `global_search_${collection}`,
          collection,
          q: keywords.join(" "),
          per_page: 100,
          page,
        }],
      };
      const { endpoint, token } = await this.getTypesense();
      const client = new JsonClient(endpoint);
      const results = (await client.post<{ results: (Results | Error)[] }>(
        `/multi_search?x-typesense-api-key=${token}`,
        body,
      )).results;
      if (!results[0]) break;
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
          yield {
            ...document,
            type,
          } as T;
        }
        if (!results[0].hits.length) break;
        page++;
      } else {
        break;
      }
    }
  }

  /** Load and parse the homepage to scrape Typesense details. */
  private async getTypesense(): Promise<Typesense> {
    if (this.typesense) return this.typesense;

    const response = await fetch(SITE);
    if (!response.ok) throw new Error("Failed to fetch homepage");
    const doc = new DOMParser().parseFromString(
      await response.text(),
      "text/html",
    );
    const scripts = doc.querySelector("head")?.querySelectorAll("script");
    for (const script of scripts ?? []) {
      const src = script.attributes.getNamedItem("src")?.value;
      if (!src || !/webpack/.test(src)) continue;
      const response = await fetch(new URL(src, SITE));
      if (!response.ok) throw new Error(`Failed to fetch webpack script`);
      const text = await response.text();
      for (const src of text.matchAll(/"(static\/chunks\/[^"]+?\.js)"/g)) {
        const response = await fetch(new URL(`/_next/${src[1]}`, SITE));
        if (!response.ok) throw new Error(`Failed to fetch next script`);
        const text = await response.text();
        const [, token, host, port, protocol] = TYPESENSE_PATTERN.exec(text) ??
          [];
        if (token && host) {
          return this.typesense = {
            endpoint: `${protocol ?? "https"}://${host}${
              port ? `:${port}` : ""
            }`,
            token,
          };
        }
      }
    }
    throw new Error("Typesense details not found");
  }
}
