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
    follow(id: number): Promise<boolean>;
    /** Unfollows a user. */
    unfollow(id: number): Promise<boolean>;
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
  };
}

/** Fields related to following and followers of a user on Duolingo. */
export interface Followable {
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
export interface Friend extends Followable {
  /** The user's unique numeric ID. */
  userId: number;
  /** The user's unique profile handle. */
  username: string;
  /** The user's display name. */
  displayName: string;
}

/** A user other than the current user on Duolingo. */
export interface User extends Followable {
  /** The user's unique numeric ID. */
  id: number;
  /** The user's unique profile handle. */
  username: string;
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
    | "GIFT_SENT"
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
  /** Whether the user is verified. */
  isVerified: boolean;
  /** The active language of the user of the card. */
  learningLanguageAbbrev: string;
  /** Display type of the card notification. */
  notificationType?: "MILESTONE" | "OFFER";
  /** The type of reaction already left on the card. */
  reactionType?: null | Reaction;
  /** The timestamp of the event. */
  timestamp: number;
  /** The reason for the event. */
  triggerType: string;
  /** The user's unique numeric ID. */
  userId: number;
}

/** A Duolingo league and its user rankings. */
export interface League {
  /** Date when the league started. */
  creation_date: string;
  /** The league tier, Bronze, Silver, Gold, etc. */
  tier: keyof typeof LEAGUES;
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
  reaction: string;
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
  /** Caching strategy for API requests. */
  cache?: RequestCache;
}

/** A Duolingo league tier. */
export const LEAGUES = {
  0: "Bronze League",
  1: "Silver League",
  2: "Gold League",
  3: "Sapphire League",
  4: "Ruby League",
  5: "Emerald League",
  6: "Amethyst League",
  7: "Pearl League",
  8: "Obsidian League",
  9: "Diamond League",
  10: "Quarterfinals",
  11: "Semifinals",
  12: "Finals",
} as const;

/** Creates a Duolingo API client. */
export function duolingo(options?: DuolingoOptions): Duolingo {
  const api = client("https://ios-api-cf.duolingo.com", {
    agent: "DuolingoMobile/7.119.0 (iPhone; iOS 26.3.1; Scale/3.00)",
    ...options,
  });
  let me: User;
  const duolingo: Duolingo = {
    users: {
      get: async (id) => {
        const [user, friend] = await Promise.all([
          api.get<User>(
            `/2023-05-23/users/${id}?fields=id,username,name,streak,totalXp`,
          ),
          api.get<Friend>(
            `/2023-05-23/friends/users/${id}/profile?pageSize=1`,
          ),
        ]);
        if (!user || !friend) throw new Error("User not found");
        return { ...user, ...friend } as User & Friend;
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
      follow: async (id) => {
        const me = await duolingo.users.me();
        const result = await api.post<{ successful: boolean }>(
          `/2023-05-23/friends/users/${me.id}/follow/${id}`,
        );
        return result.successful ?? false;
      },
      unfollow: async (id) => {
        const me = await duolingo.users.me();
        const result = await api.delete<{ successful: boolean }>(
          `/2023-05-23/friends/users/${me.id}/follow/${id}`,
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
        let cursor = null;
        const result: Friend[] = [];
        do {
          type Following = { cursor: string | null; users: Friend[] };
          // deno-lint-ignore no-await-in-loop
          const following: Following | undefined = (await api.get<
            { following: Following }
          >(`/2023-05-23/friends/users/${me.id}/following${
            cursor ? `?pageAfter=${cursor}` : ""
          }`))?.following;
          cursor = following?.cursor;
          result.push(...following?.users ?? []);
        } while (cursor);
        return result;
      },
      followers: async () => {
        const me = await duolingo.users.me();
        let cursor = null;
        const result: Friend[] = [];
        do {
          type Followers = { cursor: string | null; users: Friend[] };
          // deno-lint-ignore no-await-in-loop
          const followers: Followers | undefined = (await api.get<
            { followers: Followers }
          >(`/2023-05-23/friends/users/${me.id}/followers${
            cursor ? `?pageAfter=${cursor}` : ""
          }`))?.followers;
          cursor = followers?.cursor;
          result.push(...followers?.users ?? []);
        } while (cursor);
        return result;
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
        const { active } = await api.get<{
          active: { cohort: League; contest: { ruleset: { tiered: boolean } } };
        }>(
          join(
            "/leaderboards/7d9f5dd1-8423-491a-91f2-2532052038ce/users",
            `${me.id}?client_unlocked=true&get_reactions=true`,
          ),
        );
        if (active?.contest?.ruleset?.tiered && active?.cohort?.tier) {
          active.cohort.tier += 10;
        }
        return active?.cohort;
      },
    },
  };
  return duolingo;
}
