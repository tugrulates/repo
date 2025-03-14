// deno-lint-ignore-file camelcase -- fields are named as they are in the API

import type { LANGUAGES, LEAGUES, REACTIONS } from "./data.ts";

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

/** A reaction to a Duolingo feed event. */
export type Reaction = keyof typeof REACTIONS;

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
  tier: keyof typeof LEAGUES;
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
