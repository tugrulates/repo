// deno-lint-ignore-file camelcase
/**
 * Interacts with Duolingo, the language learning platform.
 *
 * @example Duolingo feed through the API client
 * ```ts
 * import { duolingo } from "@tugrulates/duolingo";
 *
 * async function _usage(username: string, token: string) {
 *   const api = duolingo({ username, token });
 *   for (const card of await api.feed.get()) {
 *     // deno-lint-ignore no-console
 *     console.log(card);
 *   }
 * }
 * ```
 *
 * @example Duolingo feed through the command-line application
 * ```sh
 * export DUOLINGO_USERNAME=TugrulAtes
 * export DUOLINGO_TOKEN=token
 * deno run -A --unstable-kv jsr:@tugrulates/duolingo/cli feed
 * ```
 *
 * @module duolingo
 */

import { pool } from "@roka/async/pool";
import { client } from "@roka/http/json";
import { join } from "@std/path";

/** A Duolingo API client returned from the {@linkcode duolingo} function. */
export interface Duolingo {
  /** Operations on users. */
  users: {
    /** Returns a user's profile. */
    get(id: number): Promise<User>;
    /** Returns the the authenticated user. */
    me(): Promise<User>;
    /** Follows a user. */
    follow(user: Friend | number): Promise<boolean>;
    /** Unfollows a user. */
    unfollow(user: Friend | number): Promise<boolean>;
  };
  /** Operations on user's follow lists. */
  follows: {
    /** Returns the users followed by and following the authenticated user. */
    get(): Promise<Follows>;
    /** Returns the users followed by the authenticated user. */
    following(): Promise<Friend[]>;
    /** Returns the users following the authenticated user. */
    followers(): Promise<Friend[]>;
  };
  /** Operations on the user's feed. */
  feed: {
    /** Returns the feed of the authenticated user. */
    get(): Promise<FeedCard[]>;
    /**
     * Reacts to a feed event.
     *
     * If a reaction is not provided, one based on the card content will be
     * picked.
     */
    react(card: FeedCard, reaction?: Reaction): Promise<void>;
  };
  /** Operations on the user's league. */
  league: {
    /** Returns the league of the authenticated user. */
    get(): Promise<League | undefined>;
    /** Follows all users in the league. */
    follow(league: League): Promise<void>;
  };
}

/** Code for a language track on Duolingo. */
export type LanguageCode = keyof typeof LANGUAGES;

/** A user other than the current user on Duolingo. */
export interface Friend {
  /** The user's unique numeric ID. */
  userId: number;
  /** The user's unique profile handle. */
  username: string;
  /** The user's display name. */
  displayName: string;
  /** Whether the user can be followed. */
  canFollow: boolean;
  /** Whether the user is followed by the current user. */
  isFollowedBy: boolean;
  /** Whether the current user is following the user. */
  isFollowing: boolean;
  /** Whether the user is verified. */
  isVerified: boolean;
}

/** A user other than the current user on Duolingo. */
export interface User extends Friend {
  /** The user's unique numeric ID. */
  id: number;
  /** The user's display name. */
  name: string;
  /** The user's Duolingo streak. */
  streak: number;
  /** Total experience points the user has earned. */
  totalXp: number;
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
  /** List of users on the league ordered by XP. */
  rankings: Ranking[];
}

/** A user in a Duolingo league. */
export interface Ranking {
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
  0: "Diamond Tournament",
  1: "Bronze",
  2: "Silver",
  3: "Gold",
  4: "Sapphire",
  5: "Ruby",
  6: "Diamond",
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
  let me: User;
  const duolingo: Duolingo = {
    users: {
      get: async (id) => {
        const [user, friend] = await Promise.all([
          api.get<User>(
            `/2023-05-23/users/${id}?fields=id,username,name,streak,totalXp`,
          ),
          api.get<Friend>(
            `/2017-06-30/friends/users/${id}/profile?pageSize=1`,
          ),
        ]);
        if (!user || !friend) throw new Error("User not found");
        return { ...user, ...friend } as User;
      },
      me: async () => {
        if (me) return me;
        if (!options?.username) throw new Error("Username is required");
        const { users } = await api.get<{ users: { id: number }[] }>(
          `/2023-05-23/users?fields=users%7Bid%7D&username=${options.username}`,
        );
        if (!users || !users[0]) throw new Error("User not found");
        me = await duolingo.users.get(users[0].id);
        return me;
      },
      follow: async (friend) => {
        if (typeof friend === "number") {
          friend = await duolingo.users.get(friend);
        }
        const me = await duolingo.users.me();
        const result = await api.post<{ successful: boolean }>(
          `/2017-06-30/friends/users/${me.id}/follow/${friend.userId}`,
        );
        return result.successful ?? false;
      },
      unfollow: async (friend) => {
        if (typeof friend === "number") {
          friend = await duolingo.users.get(friend);
        }
        const me = await duolingo.users.me();
        const result = await api.post<{ successful: boolean }>(
          `/2017-06-30/friends/users/${me.id}/unfollow/${friend.userId}`,
        );
        return result.successful ?? false;
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
          dontFollowBack: following.filter(({ userId }) =>
            !followers.some((friend) => friend.userId === userId)
          ),
          notFollowingBack: followers.filter(({ userId }) =>
            !following.some((friend) => friend.userId === userId)
          ),
        };
      },
      following: async () => {
        const me = await duolingo.users.me();
        return (await api.get<{ following: { users: Friend[] } }>(
          `/2017-06-30/friends/users/${me.id}/following`,
        ))?.following?.users ?? [];
      },
      followers: async () => {
        const me = await duolingo.users.me();
        return (await api.get<{ followers: { users: Friend[] } }>(
          `/2017-06-30/friends/users/${me.id}/followers`,
        ))?.followers?.users ?? [];
      },
    },
    feed: {
      get: async () => {
        const me = await duolingo.users.me();
        return (await api.get<{ feed: { feedCards: FeedCard[] }[] }>(
          `/2023-05-23/friends/users/${me.id}/feed/v2?uiLanguage=en`,
        ))?.feed?.flatMap((feed) => feed.feedCards) ?? [];
      },
      react: async (card) => {
        const me = await duolingo.users.me();
        await api.post(`/card/reaction`, {
          body: {
            groupId: card.eventId,
            reaction: "LOVE",
            trackingProperties: { screen: "kudos_feed" },
            userId: me.id,
          },
        });
      },
    },
    league: {
      get: async () => {
        const me = await duolingo.users.me();
        const { active } = await api.get<{ active: { cohort: League } }>(
          join(
            "/leaderboards/7d9f5dd1-8423-491a-91f2-2532052038ce/users",
            `${me.id}?client_unlocked=true&get_reactions=true`,
          ),
        );
        return active?.cohort;
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
