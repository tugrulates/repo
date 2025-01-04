import { toPascalCase } from "@std/text";
import * as uuid from "@std/uuid";
import { JsonClient } from "@tugrulates/internal/request";
import type { Attraction, Destination, Story } from "./types.ts";

/** A results page for a query on the Lonely Planet. */
interface Results {
  hits: [{ document: Destination | Attraction | Story }];
}

/** A Typesense server error. */
interface Error {
  code: number;
  error: string;
}

/**
 * Client for interacting with the Lonely Planet API.
 *
 * Requires credentials to the Typesense API, which can be obtained from the Lonely Planet frontend.
 */
export class LonelyPlanetClient {
  private client: JsonClient;

  /**
   * Creates an instance of the Lonely Planet client.
   *
   * @param endpoint The endpoint for the Lonely Planet API.
   * @param token The Typesense API key.
   */
  constructor(endpoint: string, private token: string) {
    this.client = new JsonClient(endpoint);
  }

  /**
   * Searches Lonely Planet for destinations with the given keywords.
   *
   * @param keywords The keywords to search for.
   * @returns Generator for the search results.
   */
  async *searchDestionations(keywords: string[]): AsyncGenerator<Destination> {
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
      const results = (await this.client.post<
        { results: (Results | Error)[] }
      >(
        `/multi_search?x-typesense-api-key=${this.token}`,
        body,
      )).results[0];
      if ("error" in results) {
        throw new Error(results.error);
      } else if ("hits" in results) {
        for (const hit of results.hits) {
          const document = hit.document;
          // ignore documents from old ID formats, as these are duplicates
          if (uuid.validate(document.id)) {
            // cleanup types
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
        }
        if (!results.hits.length) break;
        page++;
      } else {
        break;
      }
    }
  }
}
