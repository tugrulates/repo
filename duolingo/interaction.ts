import { pool } from "@roka/async/pool";
import type { DuolingoClient } from "./client.ts";
import { LANGUAGES, REACTIONS } from "./data.ts";
import type {
  FeedCard,
  Friend,
  LanguageCode,
  LeagueUser,
  Reaction,
} from "./types.ts";

/**
 * Returns the reaction on the card, or picks an appripriate one.
 *
 * @param card Card to get the reaction for.
 * @returns Reaction on the card.
 */
export function getReaction(card: FeedCard): Reaction {
  if (card.reactionType) return card.reactionType;
  if (card.cardType === "SHARE_SENTENCE_OFFER") return "like";
  const number = card.body.match(/\d+/);
  if (number && Number(number[0]) % 100 === 0) return "cheer";
  if (
    card.triggerType === "top_three" || card.triggerType === "league_promotion"
  ) return "love";
  if (card.triggerType === "resurrection") return "high_five";
  if (card.triggerType === "monthly_goal") return "support";
  if (card.defaultReaction !== null) return card.defaultReaction;
  return "cheer";
}

/**
 * Returns the emoji for the user's reaction.
 *
 * @param user User to get the emoji for.
 * @returns Emoji for the user's reaction.
 */
export function getLeagueUserEmoji(user: LeagueUser): string {
  if (user.reaction === "ANGRY") return "😡";
  if (user.reaction === "CAT") return "😺";
  if (user.reaction === "EYES") return "👀";
  if (user.reaction === "FLEX") return "💪";
  if (user.reaction === "POOP") return "💩";
  if (user.reaction === "POPCORN") return "🍿";
  if (user.reaction === "SUNGLASSES") return "😎";
  if (user.reaction.startsWith("FLAG")) {
    return LANGUAGES[user.reaction.split(",")[1] as LanguageCode].emoji;
  }
  return "";
}

/**
 * Returns the display emoji for the card.
 *
 * @param card Card to get the emoji for.
 * @returns Display emoji for the card.
 */
export function getEmoji(card: FeedCard): string {
  if (card.cardType === "FOLLOW" || card.cardType === "FOLLOW_BACK") {
    return "👤";
  }
  return REACTIONS[getReaction(card)];
}

/**
 * Engages with the event, following the user or sending a reaction.
 *
 * @param followers List of followers, to skip in follow-backs.
 * @param card Card to engage with.
 * @returns True if the event was engaged with.
 */
export async function engageWithCard(
  client: DuolingoClient,
  followers: Friend[],
  card: FeedCard,
): Promise<boolean> {
  if (card.cardType === "FOLLOW") {
    const user = followers.find((user) => user.userId === card.userId);
    if (!user?.isFollowing && !user?.canFollow) {
      await client.followUser(card.userId);
      return true;
    }
  } else if (
    card.cardType === "KUDOS_OFFER" ||
    card.cardType === "SHARE_SENTENCE_OFFER"
  ) {
    if (!card.reactionType) {
      await client.sendReaction(card.eventId, getReaction(card));
      return true;
    }
  }
  return false;
}

/**
 * Follows all the users in the league.
 *
 * @param users Users to follow.
 */
export async function followLeagueUsers(
  client: DuolingoClient,
  users: LeagueUser[],
) {
  const leagueUsers = await Promise.all(
    users.map((user) => client.getUser(user.user_id)),
  );

  await pool(
    leagueUsers.filter((user) => user.canFollow && !user.isFollowing),
    async (user) => await client.followUser(user.userId),
  );
}
