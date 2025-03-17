/**
 * Generates emojis for various Duolingo entities.
 *
 * @module emoji
 */

import type {
  FeedCard,
  LanguageCode,
  League,
  LeagueUser,
  Reaction,
} from "./duolingo.ts";

/** Returns an emoji corresponding to a reaction. */
export function reactionEmoji(reaction: Reaction | FeedCard): string {
  if (typeof reaction !== "string") {
    reaction = reaction.reactionType ?? "congrats";
  }
  return {
    congrats: "🎉",
    high_five: "🙏",
    support: "💪",
    cheer: "💯",
    love: "💖",
    like: "👍",
    haha: "😂",
  }[reaction];
}

/** Returns an emoji corresponding to a league tier. */
export function leagueEmoji(league: League): string {
  return {
    0: "🧡",
    1: "🤍",
    2: "💛",
    3: "💙",
    4: "❤️",
    5: "💚",
    6: "💜",
    7: "🩷",
    8: "🖤",
    9: "💎",
    10: "🏆",
  }[league.tier];
}

/** Returns an emoji corresponding to a language code. */
export function languageEmoji(code: LanguageCode): string {
  return {
    ar: "🇸🇦",
    ca: "🇪🇸",
    cs: "🇨🇿",
    cy: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
    da: "🇩🇰",
    de: "🇩🇪",
    dn: "🇳🇱",
    el: "🇬🇷",
    en: "🇺🇸",
    eo: "🌍",
    es: "🇪🇸",
    fi: "🇫🇮",
    fr: "🇫🇷",
    ga: "🇮🇪",
    gd: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    gn: "🇵🇾",
    he: "🇮🇱",
    hi: "🇮🇳",
    ht: "🇭🇹",
    hu: "🇭🇺",
    hv: "🐉",
    hw: "🌺",
    id: "🇮🇩",
    it: "🇮🇹",
    ja: "🇯🇵",
    kl: "🖖",
    ko: "🇰🇷",
    la: "🏛️",
    math: "🔢",
    music: "🎵",
    nb: "🇳🇴",
    nv: "🏜️",
    pl: "🇵🇱",
    pt: "🇧🇷",
    ro: "🇷🇴",
    ru: "🇷🇺",
    sv: "🇸🇪",
    sw: "🇰🇪",
    tr: "🇹🇷",
    uk: "🇺🇦",
    vi: "🇻🇳",
    yi: "🕎",
    zc: "🇭🇰",
    zs: "🇨🇳",
    zu: "🇿🇦",
  }[code];
}

/** Returns an emoji corresponding to a league user. */
export function leagueUserEmoji(user: LeagueUser): string {
  if (user.reaction === "ANGRY") return "😡";
  if (user.reaction === "CAT") return "😺";
  if (user.reaction === "EYES") return "👀";
  if (user.reaction === "FLEX") return "💪";
  if (user.reaction === "POOP") return "💩";
  if (user.reaction === "POPCORN") return "🍿";
  if (user.reaction === "SUNGLASSES") return "😎";
  if (user.reaction.startsWith("FLAG")) {
    return languageEmoji(user.reaction.split(",")[1] as LanguageCode);
  }
  return "";
}
