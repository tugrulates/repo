import { type Client, client } from "@roka/http/graphql/client";
import type { Category, Photo, User } from "./types.ts";

/**
 * Client for interacting with the 500px GraphQL API.
 *
 * Provides the logged out experience, and does not require authentication.
 */
export class FiveHundredPxClient {
  private client: Client;

  /**
   * Creates an instance of the client.
   *
   * @param options Optional configuration options.
   * @param options.token Optional authentication token.
   */
  constructor(options: { token?: string } = {}) {
    this.client = client("https://api.500px.com/graphql", options);
  }

  /**
   * Retrieves photos for a given user.
   *
   * @param username The username of the user whose photos are to be retrieved.
   * @returns The user's photos.
   */
  async getPhotos(username: string): Promise<Photo[]> {
    return await this.client.queryPaginated<
      {
        user: {
          photos: {
            edges: { node: Photo }[];
            totalCount: number;
            pageInfo: { endCursor: string; hasNextPage: boolean };
          };
        };
      },
      Photo,
      { node: Photo },
      { endCursor: string; hasNextPage: boolean }
    >(
      await query(["graphql/photos", "graphql/photo"]),
      {
        edges: (data) => data.user.photos.edges,
        node: (edge) => edge.node,
        pageInfo: (data) => data.user.photos.pageInfo,
        cursor: (pageInfo) => pageInfo.hasNextPage ? pageInfo.endCursor : null,
      },
      { username },
    );
  }

  /**
   * Retrieves the list of users followed by a given user.
   *
   * @param username The username of the user whose following list is to be retrieved.
   * @returns The list of users followed by the given user.
   */
  async getFollowing(username: string): Promise<User[]> {
    return await this.client.queryPaginated<
      {
        user: {
          following: {
            users: {
              edges: { node: User }[];
              totalCount: number;
              pageInfo: { endCursor: string; hasNextPage: boolean };
            };
          };
        };
      },
      User,
      { node: User },
      { endCursor: string; hasNextPage: boolean }
    >(
      await query(["graphql/following", "graphql/user"]),
      {
        edges: (data) => data.user.following.users.edges,
        node: (edge) => edge.node,
        pageInfo: (data) => data.user.following.users.pageInfo,
        cursor: (pageInfo) => pageInfo.hasNextPage ? pageInfo.endCursor : null,
      },
      { username },
    );
  }

  /**
   * Retrieves the list of followers for a given user.
   *
   * @param username The username of the user whose followers are to be retrieved.
   * @returns The list of followers of the given user.
   */
  async getFollowers(username: string): Promise<User[]> {
    return await this.client.queryPaginated<
      {
        user: {
          followedBy: {
            users: {
              edges: { node: User }[];
              totalCount: number;
              pageInfo: { endCursor: string; hasNextPage: boolean };
            };
          };
        };
      },
      User,
      { node: User },
      { endCursor: string; hasNextPage: boolean }
    >(
      await query(["graphql/followers", "graphql/user"]),
      {
        edges: (data) => data.user.followedBy.users.edges,
        node: (edge) => edge.node,
        pageInfo: (data) => data.user.followedBy.users.pageInfo,
        cursor: (pageInfo) => pageInfo.hasNextPage ? pageInfo.endCursor : null,
      },
      { username },
    );
  }

  /**
   * Retrieves the "For You" feed.
   *
   * @param options Configuration options.
   * @param options.limit The maximum number of items to retrieve.
   * @param options.categories The categories to filter the feed by.
   * @returns The "For You" feed photos.
   */
  async getForYouFeed(
    options: { limit?: number; categories?: Category[] } = {},
  ): Promise<Photo[]> {
    return (await this.client.queryPaginated<
      {
        feed: {
          edges: { node: { cardNode: Photo } }[];
          totalCount: number;
          pageInfo: { endCursor: string; hasNextPage: boolean };
        };
      },
      { cardNode: Photo },
      { node: { cardNode: Photo } },
      { endCursor: string; hasNextPage: boolean }
    >(
      await query(["graphql/foryou"]),
      {
        edges: (data) => data.feed.edges,
        node: (edge) => edge.node,
        pageInfo: (data) => data.feed.pageInfo,
        cursor: (pageInfo) => pageInfo.hasNextPage ? pageInfo.endCursor : null,
      },
      {
        ...options,
        categories: options.categories?.map((category) => category.id),
        showNude: options.categories?.some((category) => category.nude),
      },
    )).map((card) => card.cardNode);
  }
}

async function query(paths: string[]): Promise<string> {
  return (await Promise.all(
    paths.map(async (path) =>
      await Deno.readTextFile(
        new URL(`${path}.graphql`, Deno.mainModule),
      )
    ),
  )).join("\n");
}
