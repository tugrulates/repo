import { JsonClient } from "@tugrulates/internal/request";
import type { FeedCard, Friend, League, Reaction } from "./types.ts";

/**
 * A client for interacting with the Duolingo API.
 *
 * Requires the JWT (JSON web token) for the logged-in user.
 */
export class DuolingoClient {
  private client: JsonClient;
  private userid?: number;

  /**
   * Creates an instance of the Duolingo client for the specified username and token.
   *
   * @param username The username of the Duolingo user.
   * @param token The authentication token for the Duolingo user.
   */
  constructor(private username: string, token: string) {
    this.client = new JsonClient("https://www.duolingo.com", { token });
  }

  /**
   * Gets the user ID for the given username.
   *
   * @returns The numeric user ID.
   */
  async getUserId(): Promise<number> {
    if (!this.username) throw new Error("Username is required");
    if (this.userid) return this.userid;
    this.userid = (await this.client.get<{ users: { id: number }[] }>(
      `/2017-06-30/users?fields=users%7Bid%7D&username=${this.username}`,
    )).users[0].id;
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
    )).following.users;
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
    )).followers.users;
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
    )).feed.flatMap((feed) => feed.feedCards);
  }

  /**
   * Gets the league for the user.
   *
   * @returns The league that the user is currently in.
   */
  async getLeague(): Promise<League> {
    const me = await this.getUserId();
    return (await this.client.get<{ active: { cohort: League } }>(
      `/leaderboards/7d9f5dd1-8423-491a-91f2-2532052038ce/users/${me}?client_unlocked=true&get_reactions=true`,
    )).active.cohort;
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
      reactionTimestamp: new Date().getTime(),
      trackingProperties: { screen: "kudos_feed" },
      userId: await this.getUserId(),
    });
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
