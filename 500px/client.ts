import { GraphQLClient } from "@tugrulates/internal/graphql";
import type { Category, Photo, User } from "./types.ts";

/**
 * Client for interacting with the 500px GraphQL API.
 *
 * Provides the logged out experience, and does not require authentication.
 */
export class FiveHundredPxClient {
  private client: GraphQLClient;

  /**
   * Creates an instance of the client.
   *
   * @param options Optional configuration options.
   * @param options.token Optional authentication token.
   */
  constructor(options: { token?: string } = {}) {
    this.client = new GraphQLClient("https://api.500px.com/graphql", options);
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
      Photo
    >(
      ["graphql/photos", "graphql/photo"],
      (data) => data.user.photos,
      (data) =>
        data.user.photos.pageInfo.hasNextPage
          ? data.user.photos.pageInfo.endCursor
          : null,
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
      User
    >(
      ["graphql/following", "graphql/user"],
      (data) => data.user.following.users,
      (data) =>
        data.user.following.users.pageInfo.hasNextPage
          ? data.user.following.users.pageInfo.endCursor
          : null,
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
      User
    >(
      ["graphql/followers", "graphql/user"],
      (data) => data.user.followedBy.users,
      (data) =>
        data.user.followedBy.users.pageInfo.hasNextPage
          ? data.user.followedBy.users.pageInfo.endCursor
          : null,
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
      { cardNode: Photo }
    >(
      ["graphql/foryou"],
      (data) => data.feed,
      (
        data,
      ) => (data.feed.pageInfo.hasNextPage
        ? data.feed.pageInfo.endCursor
        : null),
      {
        categories: options.categories?.map((category) => category.id),
        showNude: options.categories?.some((category) => category.nude),
        limit: options.limit,
      },
    )).map((card) => card.cardNode);
  }
}
