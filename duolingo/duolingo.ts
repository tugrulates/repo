// deno-lint-ignore-file camelcase
/**
 * Interact with Duolingo, the language learning platform.
 *
 * @example Search 500px through the API client.
 * ```ts
 * import { duolingo } from "@tugrulates/duolingo";
 *
 * async function usage(username: string, token: string) {
 *   const api = duolingo({ username, token });
 *   for (const card of await api.feed()) {
 *     console.log(card);
 *   }
 * }
 * ```
 *
 * @example Search 500px through the command-line application.
 * ```sh
 * export DUOLINGO_USERNAME=TugrulAtes
 * export DUOLINGO_TOKEN=token
 * deno run -A --unstable-kv jsr:@tugrulates/duolingo/cli feed
 * ``
 *
 * @module duolingo
 */

import { pool } from "@roka/async/pool";
import { type Client, client } from "@roka/http/json/client";
import { join } from "@std/path/join";

/** A Duolingo API client returned from the {@linkcode duolingo} function. */
export interface Duolingo {
  /** Operations on users. */
  users: {
    /** Return a user's profile. */
    get(id: number): Promise<User>;
    /** Return the user ID of the authenticated user. */
    me(): Promise<User>;
    /** Follow a user. */
    follow(user: User | number): Promise<void>;
    /** Unfollow a user. */
    unfollow(user: User | number): Promise<void>;
  };
  /** Operations on user's follow lists. */
  follows: {
    /** Return the users followed by and following the authenticated user. */
    get(): Promise<Follows>;
    /** Return the users followed by the authenticated user. */
    following(): Promise<Friend[]>;
    /** Return the users following the authenticated user. */
    followers(): Promise<Friend[]>;
  };
  /** Operations on the user's feed. */
  feed: {
    /** Return the feed of the authenticated user. */
    get(): Promise<FeedCard[]>;
    /**
     * React to a feed event.
     *
     * If a reaction is not provided, one based on the card content will be
     * picked.
     */
    react(card: FeedCard, reaction?: Reaction): Promise<void>;
  };
  /** Operations on the user's league. */
  league: {
    /** Return the league of the authenticated user. */
    get(): Promise<League | undefined>;
    /** Follow all users in the league. */
    follow(league: League): Promise<void>;
  };
}

/** Code for a language track on Duolingo. */
export type LanguageCode = keyof typeof LANGUAGES;

/** A user other than the current user on Duolingo. */
export interface User {
  /** The user's unique numeric ID. */
  userId: number;
  /** Whether the user can be followed. */
  canFollow?: boolean;
  /** Whether the user is followed by the current user. */
  isFollowedBy?: boolean;
  /** Whether the current user is following the user. */
  isFollowing?: boolean;
  /** Whether the user is verified. */
  isVerified?: boolean;
}

/** A follower or followed user. */
export interface Friend extends User {
  /** The user's display name. */
  displayName: string;
  /** Whether the user has a subscription to Duolingo Plus. */
  hasSubscription: boolean;
  /** Whether the user is recently active. */
  isCurrentlyActive: boolean;
  /** The user's profile picture URL. */
  picture: string;
  /** The user's Duolingo subscription type. */
  subscriptionItemType: string;
  /** The user's total experience points. */
  totalXp: number;
  /** The user's unique profile handle. */
  username: string;
}

/** A user's follow relationships. */
export interface Follows {
  /** Users followed by the current user. */
  following: Friend[];
  /** Users following the current user. */
  followers: Friend[];
  /** Users followed by the current user but not following back. */
  dontFollowBack: Friend[];
  /** Users following the current user but not followed back. */
  notFollowingBack: Friend[];
}

/** A reaction to a Duolingo feed event. */
export type Reaction =
  | "cheer"
  | "congrats"
  | "haha"
  | "high_five"
  | "like"
  | "love"
  | "support";

/** A Duolingo feed card, like a milestone or league promotion. */
export interface FeedCard {
  /** The body text of the card. */
  body: string;
  /** The unique identifier of the card. */
  cardId: string;
  /** The type of card. */
  cardType:
    | "FOLLOW"
    | "FOLLOW_BACK"
    | "KUDOS_MILESTONE"
    | "KUDOS_OFFER"
    | "SHARE_SENTENCE_OFFER";
  /** The user's display name. */
  displayName: string;
  /** The suggested reaction to the card. */
  defaultReaction: null | Reaction;
  /** The unique identifier of the event. */
  eventId: string;
  /** The title for the card. */
  header?: string;
  /** Whether the card allows interaction. */
  isInteractionEnabled: boolean;
  /** Whether the user is verified. */
  isVerified: boolean;
  /** The active language of the user of the card. */
  learningLanguage: string;
  /** Display type of the card notification. */
  notificationType?: "MILESTONE" | "OFFER";
  /** The number of reactions to the card. */
  reactionCounts: {
    cheer?: number;
    congrats?: number;
    high_five?: number;
    love?: number;
    support?: number;
  };
  /** The type of reaction already left on the card. */
  reactionType?: null | Reaction;
  /** The timestamp of the event. */
  timestamp: number;
  /** The reason for the event. */
  triggerType?:
    | "friends_quest_complete"
    | "friends_quest_streak"
    | "league_promotion"
    | "monthly_goal"
    | "resurrection"
    | "sage"
    | "streak_milestone"
    | "top_three"
    | "x_lesson";
  /** The user's unique numeric ID. */
  userId: number;
}

/** A Duolingo league and its user rankings. */
export interface League {
  /** Date when the league started. */
  creation_date: string;
  /** The league tier, Bronze, Silver, Gold, etc. */
  tier: keyof typeof TIERS;
  /** List of users on the leauge ordered by XP. */
  rankings: LeagueUser[];
}

/** A user in a Duolingo league. */
export interface LeagueUser {
  /** The user's profile picture URL. */
  avatar_url: string;
  /** The user's display name. */
  display_name: string;
  /** Whether the user has a Duolingo Plus subscription. */
  has_plus: boolean;
  /** Whether the use is recently active. */
  has_recent_activity_15: boolean;
  /** The user's reaction symbol. */
  reaction:
    | "NONE"
    | "ANGRY"
    | "CAT"
    | "EYES"
    | `FLAG,${LanguageCode}`
    | "FLEX"
    | "POOP"
    | "POPCORN"
    | "SUNGLASSES"
    | "YEAR_IN_REVIEW,2023_top1"
    | "YIR_2022";
  /** The user's total XP. */
  score: number;
  /** Whether the user has gained XP today. */
  streak_extended_today: boolean;
  /** The user's unique numeric ID. */
  user_id: number;
}

/** Options for the {@link duolingo} function. */
export interface DuolingoOptions {
  /** The username of the Duolingo user. */
  username: string;
  /** The authentication token for the Duolingo user. */
  token: string;
}

/** A Duolingo league tier. */
export const TIERS = {
  1: "Bronze",
  2: "Silver",
  3: "Gold",
  4: "Sapphire",
  5: "Ruby",
  6: "Diamond",
  7: "Master",
  8: "Grandmaster",
} as const;

/**
 * Language codes on Duolingo, with their names, and flags.
 *
 * This only lists target languages, and not source languages.
 *
 * @see {@link https://www.duolingo.com/courses/all Duolingo Language Courses}
 */
export const LANGUAGES = {
  ar: "Arabic",
  ca: "Catalan",
  cs: "Czech",
  cy: "Welsh",
  da: "Danish",
  de: "German",
  dn: "Dutch",
  el: "Greek",
  en: "English",
  eo: "Esperanto",
  es: "Spanish",
  fi: "Finnish",
  fr: "French",
  ga: "Irish",
  gd: "Scottish Gaelic",
  gn: "Guarani",
  he: "Hebrew",
  hi: "Hindi",
  ht: "Haitian Creole",
  hu: "Hungarian",
  hv: "High Valyrian",
  hw: "Hawaiian",
  id: "Indonesian",
  it: "Italian",
  ja: "Japanese",
  kl: "Klingon",
  ko: "Korean",
  la: "Latin",
  math: "Math",
  music: "Music",
  nb: "Norwegian (Bokmål)",
  nv: "Navajo",
  pl: "Polish",
  pt: "Portuguese",
  ro: "Romanian",
  ru: "Russian",
  sv: "Swedish",
  sw: "Swahili",
  tr: "Turkish",
  uk: "Ukrainian",
  vi: "Vietnamese",
  yi: "Yiddish",
  zc: "Chinese (Cantonese)",
  zs: "Chinese",
  zu: "Zulu",
} as const;

/** Creates a Duolingo API client. */
export function duolingo(options?: DuolingoOptions): Duolingo {
  const api = client("https://www.duolingo.com", options);
  let me: User | undefined = undefined;
  const duolingo: Duolingo = {
    users: {
      get: async (id) => {
        const user = await api.get<Omit<User, "userId">>(
          `/2017-06-30/friends/users/${id}/profile?pageSize=0`,
        );
        if (!user) throw new Error("User not found");
        return { userId: id, ...user };
      },
      me: async () => {
        if (me) return me;
        if (!options?.username) throw new Error("Username is required");
        const { users } = await api.get<{ users: { id: number }[] }>(
          `/2017-06-30/users?fields=users%7Bid%7D&username=${options.username}`,
        );
        if (!users || !users[0]) throw new Error("User not found");
        me = await duolingo.users.get(users[0].id);
        return me;
      },
      follow: async (user) => {
        if (typeof user === "number") user = await duolingo.users.get(user);
        const me = await duolingo.users.me();
        await api.post(
          `/2017-06-30/friends/users/${me.userId}/follow/${user.userId}`,
          {},
        );
      },
      unfollow: async (user) => {
        if (typeof user === "number") user = await duolingo.users.get(user);
        const me = await duolingo.users.me();
        await api.post(
          `/2017-06-30/friends/users/${me.userId}/follow/${user.userId}`,
          {},
        );
      },
    },
    follows: {
      get: async () => {
        const [following, followers] = await Promise.all([
          duolingo.follows.following(),
          duolingo.follows.followers(),
        ]);
        return {
          following,
          followers,
          dontFollowBack: following.filter(({ userId: id }) =>
            !followers.some((user) => user.userId === id)
          ),
          notFollowingBack: followers.filter(({ userId: id }) =>
            !following.some((user) => user.userId === id)
          ),
        };
      },
      following: async () => {
        const me = await duolingo.users.me();
        return (await api.get<{ followers: { users: Friend[] } }>(
          `/2017-06-30/friends/users/${me.userId}/followers`,
        ))?.followers?.users ?? [];
      },
      followers: async () => {
        const me = await duolingo.users.me();
        return (await api.get<{ following: { users: Friend[] } }>(
          `/2017-06-30/friends/users/${me.userId}/following`,
        ))?.following?.users ?? [];
      },
    },
    feed: {
      get: async () => {
        const me = await duolingo.users.me();
        return (await api.get<{ feed: { feedCards: FeedCard[] }[] }>(
          `/2017-06-30/friends/users/${me.userId}/feed/v2?uiLanguage=en`,
        ))?.feed?.flatMap((feed) => feed.feedCards) ?? [];
      },
      react: async (card, reaction) => {
        reaction ??= (() => {
          if (card.reactionType) return card.reactionType;
          if (card.cardType === "SHARE_SENTENCE_OFFER") return "like";
          const number = card.body.match(/\d+/);
          if (number && Number(number[0]) % 100 === 0) return "cheer";
          if (
            card.triggerType === "top_three" ||
            card.triggerType === "league_promotion"
          ) return "love";
          if (card.triggerType === "resurrection") return "high_five";
          if (card.triggerType === "monthly_goal") return "support";
          if (card.defaultReaction !== null) return card.defaultReaction;
          return "cheer";
        })();
        const me = await duolingo.users.me();
        await api.post(`/card/reaction`, {
          groupId: card.eventId,
          reaction: reaction.toUpperCase(),
          trackingProperties: { screen: "kudos_feed" },
          userId: me.userId,
        });
      },
    },
    league: {
      get: async () => {
        const me = await duolingo.users.me();
        const response = await api.get<{ active: { cohort: League } }>(
          join(
            "/leaderboards/7d9f5dd1-8423-491a-91f2-2532052038ce/users",
            `${me.userId}?client_unlocked=true&get_reactions=true`,
          ),
        );
        return response.active?.cohort;
      },
      follow: async (league) => {
        const users = await Promise.all(
          league.rankings.map((user) => duolingo.users.get(user.user_id)),
        );
        await pool(
          users.filter((user) => user.canFollow && !user.isFollowing),
          async (user) => await duolingo.users.follow(user),
          { concurrency: 1 },
        );
      },
    },
  };
  return duolingo;
}

/**
 * A client for interacting with the Duolingo API.
 *
 * Requires the JWT (JSON web token) for the logged-in user.
 */
export class DuolingoClient {
  private client: Client;
  private userid?: number;

  /**
   * Creates an instance of the Duolingo client with the given credentials.
   *
   * @param username The username of the Duolingo user.
   * @param token The authentication token for the Duolingo user.
   */
  constructor(private username: string, token: string) {
    this.client = client("https://www.duolingo.com", { token });
  }

  /**
   * Gets the user ID for the given username.
   *
   * @returns The numeric user ID.
   */
  async getUserId(): Promise<number> {
    if (!this.username) throw new Error("Username is required");
    if (this.userid) return this.userid;
    const users = (await this.client.get<{ users: { id: number }[] }>(
      `/2017-06-30/users?fields=users%7Bid%7D&username=${this.username}`,
    )).users;
    if (!users || !users[0]) throw new Error("User not found");
    this.userid = users[0].id;
    return this.userid;
  }

  /**
   * Gets the list of users that the user is following.
   *
   * @returns List of users that the user is following.
   */
  async getFollowing(): Promise<Friend[]> {
    const me = await this.getUserId();
    return (await this.client.get<{ following: { users: Friend[] } }>(
      `/2017-06-30/friends/users/${me}/following`,
    ))?.following?.users ?? [];
  }

  /**
   * Gets the list of users that are following the user.
   *
   * @returns List of users that are following the user.
   */
  async getFollowers(): Promise<Friend[]> {
    const me = await this.getUserId();
    return (await this.client.get<{ followers: { users: Friend[] } }>(
      `/2017-06-30/friends/users/${me}/followers`,
    ))?.followers?.users ?? [];
  }

  /**
   * Gets the feed for the user.
   *
   * @returns List of feed cards.
   */
  async getFeedCards(): Promise<FeedCard[]> {
    const me = await this.getUserId();
    return (await this.client.get<{ feed: { feedCards: FeedCard[] }[] }>(
      `/2017-06-30/friends/users/${me}/feed/v2?uiLanguage=en`,
    ))?.feed?.flatMap((feed) => feed.feedCards) ?? [];
  }

  /**
   * Gets the league for the user.
   *
   * @returns The league that the user is currently in, null if league is not started.
   */
  async getLeague(): Promise<League | undefined> {
    const me = await this.getUserId();
    const response = await this.client.get<{ active: { cohort: League } }>(
      `/leaderboards/7d9f5dd1-8423-491a-91f2-2532052038ce/users/${me}?client_unlocked=true&get_reactions=true`,
    );
    return response.active?.cohort;
  }

  /**
   * Sends a reaction to a feed event.
   *
   * @param eventId The ID of the event to react to.
   */
  async sendReaction(eventId: string, reaction: Reaction): Promise<void> {
    await this.client.post(`/card/reaction`, {
      groupId: eventId,
      reaction: reaction.toUpperCase(),
      trackingProperties: { screen: "kudos_feed" },
      userId: await this.getUserId(),
    });
  }

  /**
   * Gets a user's basic profile information.
   *
   * @param userId The numeric ID of the user to get the profile for.
   * @returns The user's profile.
   */
  async getUser(userId: number): Promise<User> {
    const user = await this.client.get<Omit<User, "userId">>(
      `/2017-06-30/friends/users/${userId}/profile?pageSize=0`,
    );
    if (!user) throw new Error("User not found");
    return { userId: userId, ...user };
  }

  /**
   * Follows a user.
   *
   * @param userId The numeric ID of the user to follow.
   */
  async followUser(userId: number): Promise<void> {
    const me = await this.getUserId();
    await this.client.post(
      `/2017-06-30/friends/users/${me}/follow/${userId}`,
      {},
    );
  }

  /**
   * Unfollows a user.
   *
   * @param userId The numeric ID of the user to unfollow.
   */
  async unfollowUser(userId: number): Promise<void> {
    const me = await this.getUserId();
    await this.client.delete(
      `/2017-06-30/friends/users/${me}/follow/${userId}`,
    );
  }
}
