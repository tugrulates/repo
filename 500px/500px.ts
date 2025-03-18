/**
 * Interact with 500px, the photo sharing platform.
 *
 * @example Search 500px through the API client.
 * ```ts
 * import { fiveHundredPx } from "@tugrulates/500px";
 *
 * async function usage() {
 *   const api = fiveHundredPx();
 *   for (const photo of await api.photos("tugrulates")) {
 *     console.log(photo.name);
 *   }
 * }
 * ```
 *
 * @example Search 500px through the command-line application.
 * ```sh
 * deno run -A jsr:@tugrulates/500px/cli photos tugrulates
 * ```
 *
 * @module 500px
 */

import { client, gql } from "@roka/http/graphql/client";

/** A 500px API client returned from the {@linkcode fiveHundredPx} function. */
export interface FiveHundredPx {
  /** Return photos submitted by a user. */
  photos(username: string): Promise<Photo[]>;
  /** Return users followed by a user. */
  following(username: string): Promise<User[]>;
  /** Return users following a user. */
  followers(username: string): Promise<User[]>;
  /**
   * Return the recommended feed of photos. Returns a non-personalized list
   * if the client is not authenticated.
   */
  feed(options?: FeedOptions): Promise<Photo[]>;
}

/** Options for the {@linkcode fiveHundredPx} function. */
export interface FiveHundredPxOptions {
  /** Authentication token to make authenticated requests. */
  token?: string;
}

/** Options for the {@linkcode FiveHundredPx.feed} function. */
export interface FeedOptions {
  /** Categories to filter the feed on. */
  categories?: Category[];
  /** Limit the number of photos returned. */
  limit?: number;
}

/** A user on 500px. */
export interface User {
  /** The user's unique numeric ID. */
  id: string;
  /** The user's unique profile handle. */
  canonicalPath: string;
  /** The user's display name. */
  displayName: string;
}

/** A photo submitted to 500px and its stats. */
export interface Photo {
  /** The unique identifier of the photo. */
  id: string;
  /** The unique path of the photo. */
  canonicalPath: string;
  /** The title of the photo. */
  name: string;
  /** The numeric category ID of the photo. */
  categoryId: number;
  /** The category of the photo. */
  category: typeof CATEGORIES[keyof typeof CATEGORIES];
  /** The date the photo was uploaded. */
  uploadedAt: string;
  /** The number of times the photo has been viewed. */
  timesViewed: number;
  /** The number of times the photo has been liked. */
  likedByUsers: { totalCount: number };
  /** The 500px pulse of the photo. */
  pulse: { highest: number };
  /** The user who submitted the photo. */
  photographer: User;
}

/** A photo category on 500px. */
export interface Category {
  /** The numeric ID of the category. */
  id: number;
  /** Whether the category contains nude content. */
  nude: boolean;
}

/**
 * Photo categories on 500px.
 *
 * Each photo belongs to a single category.
 *
 * @see {@link https://500px.com/discover/top_categories 500px Categories}
 */
export const CATEGORIES = {
  CELEBRITIES: { id: 1, opt: "celebrities", nude: false },
  FILM: { id: 2, opt: "film", nude: false },
  JOURNALISM: { id: 3, opt: "journalism", nude: false },
  NUDE: { id: 4, opt: "nude", nude: true },
  BLACK_AND_WHITE: { id: 5, opt: "black-and-white", nude: false },
  STILL_LIFE: { id: 6, opt: "still-life", nude: false },
  PEOPLE: { id: 7, opt: "people", nude: false },
  LANDSCAPES: { id: 8, opt: "landscapes", nude: false },
  CITY_AND_ARCHITECTURE: { id: 9, opt: "city-and-architecture", nude: false },
  ABSTRACT: { id: 10, opt: "abstract", nude: false },
  ANIMALS: { id: 11, opt: "animals", nude: false },
  MACRO: { id: 12, opt: "macro", nude: false },
  TRAVEL: { id: 13, opt: "travel", nude: false },
  FASHION: { id: 14, opt: "fashion", nude: false },
  COMMERCIAL: { id: 15, opt: "commercial", nude: false },
  CONCERT: { id: 16, opt: "concert", nude: false },
  SPORT: { id: 17, opt: "sport", nude: false },
  NATURE: { id: 18, opt: "nature", nude: false },
  PERFORMING_ARTS: { id: 19, opt: "performing-arts", nude: false },
  FAMILY: { id: 20, opt: "family", nude: false },
  STREET: { id: 21, opt: "street", nude: false },
  UNDERWATER: { id: 22, opt: "underwater", nude: false },
  FOOD: { id: 23, opt: "food", nude: false },
  FINE_ART: { id: 24, opt: "fine-art", nude: false },
  WEDDING: { id: 25, opt: "wedding", nude: false },
  TRANSPORTATION: { id: 26, opt: "transportation", nude: false },
  AERIAL: { id: 29, opt: "aerial", nude: false },
  URBAN_EXPLORATION: { id: 27, opt: "urban-exploration", nude: false },
  NIGHT: { id: 30, opt: "night", nude: false },
  BOUDOIR: { id: 31, opt: "boudoir", nude: true },
  UNCATEGORIZED: { id: 0, opt: "other", nude: false },
} as const;

const FRAGMENT = {
  photo: gql`
    fragment Photo on Photo {
      id
      legacyId
      canonicalPath
      name
      description
      width
      height
      categoryId
      category
      uploadedAt
      takenAt
      longitude
      latitude
      location
      locationDetails {
        city
        state
        country
      }
      aperture
      iso
      shutterSpeed
      focalLength
      tags
      watermark
      notSafeForWork
      photographer: uploader {
        id
        legacyId
        username
        displayName
        type
        isBlockedByMe
        canonicalPath
      }
      timesViewed
      likedByUsers {
        totalCount
      }
      pulse {
        highest
      }
    }
  `,
  user: gql`
    fragment User on User {
      id
      legacyId
      type
      canonicalPath
      displayName
      active
      avatar {
        images(sizes: [MEDIUM, LARGE]) {
          size
          url
          id
        }
        id
      }
      following {
        isFollowingMe
        totalCount
      }
      followedBy {
        isFollowedByMe
        totalCount
      }
    }
  `,
};

const QUERY = {
  photos: gql`
    query PhotosQuery($username: String!, $cursor: String) {
      user: userByUsername(username: $username) {
        photos(
          first: 50
          after: $cursor
          privacy: PROFILE
          sort: ID_DESC
          excludeNude: false
        ) {
          edges {
            node {
              ...Photo
              __typename
            }
          }
          totalCount
          pageInfo {
            endCursor
            hasNextPage
          }
        }
        id
      }
    }
    ${FRAGMENT.photo}
  `,
  followers: gql`
    query FollowerQuery($username: String!, $cursor: String) {
      user: userByUsername(username: $username) {
        followedBy {
          users: followedByUsers(first: 100, after: $cursor) {
            edges {
              node {
                ...User
                __typename
              }
              cursor
            }
            totalCount
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }
        id
      }
    }
    ${FRAGMENT.user}
  `,
  following: gql`
    query FollowingQuery($username: String!, $cursor: String) {
      user: userByUsername(username: $username) {
        following {
          users: followingUsers(first: 100, after: $cursor) {
            edges {
              node {
                ...User
                __typename
              }
              cursor
            }
            totalCount
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }
        id
      }
    }
    ${FRAGMENT.user}
  `,
  feed: gql`
    query FeedQuery($cursor: String, $categories: [Int], $showNude: Boolean) {
      feed: forYouFeedContent(
        first: 100
        after: $cursor
        categories: $categories
        contentType: PHOTO
        showNude: $showNude
      ) {
        edges {
          cursor
          node {
            id
            cardNode {
              ...Photo
              __typename
            }
            cardType
            __typename
          }
        }
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
    ${FRAGMENT.photo}
  `,
};

/** Creates a 500px API client. */
export function fiveHundredPx(options?: FiveHundredPxOptions): FiveHundredPx {
  const api = client("https://api.500px.com/graphql", options);
  return {
    photos: async (username) => {
      return await api.queryPaginated<
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
        QUERY.photos,
        {
          edges: (data) => data.user.photos.edges,
          node: (edge) => edge.node,
          pageInfo: (data) => data.user.photos.pageInfo,
          cursor: (pageInfo) =>
            pageInfo.hasNextPage ? pageInfo.endCursor : null,
        },
        { username },
      );
    },
    following: async (username) => {
      return await api.queryPaginated<
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
        QUERY.following,
        {
          edges: (data) => data.user.following.users.edges,
          node: (edge) => edge.node,
          pageInfo: (data) => data.user.following.users.pageInfo,
          cursor: (pageInfo) =>
            pageInfo.hasNextPage ? pageInfo.endCursor : null,
        },
        { username },
      );
    },
    followers: async (username) => {
      return await api.queryPaginated<
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
        QUERY.followers,
        {
          edges: (data) => data.user.followedBy.users.edges,
          node: (edge) => edge.node,
          pageInfo: (data) => data.user.followedBy.users.pageInfo,
          cursor: (pageInfo) =>
            pageInfo.hasNextPage ? pageInfo.endCursor : null,
        },
        { username },
      );
    },
    feed: async (options) => {
      return (await api.queryPaginated<
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
        QUERY.feed,
        {
          edges: (data) => data.feed.edges,
          node: (edge) => edge.node,
          pageInfo: (data) => data.feed.pageInfo,
          cursor: (pageInfo) =>
            pageInfo.hasNextPage ? pageInfo.endCursor : null,
        },
        {
          ...options,
          categories: options?.categories?.map((category) => category.id),
          showNude: options?.categories?.some((category) => category.nude),
        },
      )).map((card) => card.cardNode);
    },
  };
}
