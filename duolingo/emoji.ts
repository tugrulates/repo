/**
 * Generates emojis for various Duolingo entities.
 *
 * @module emoji
 */

import type { League, Ranking } from "./duolingo.ts";

/** Returns an emoji corresponding to a league tier. */
export function leagueEmoji(league: League): string {
  return {
    0: "🤎",
    1: "🩶",
    2: "💛",
    3: "💙",
    4: "❤️",
    5: "💚",
    6: "💜",
    7: "🩷",
    8: "🖤",
    9: "💎",
    10: "🏆",
    11: "🏆",
    12: "🏆",
  }[league.tier];
}

/** Returns an emoji corresponding to a language code. */
export function languageEmoji(code: string): string {
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
    chess: "♟️",
    math: "🔢",
    music: "🎵",
  }[code] ?? "";
}

/** Returns an emoji corresponding to a league user. */
export function leagueUserEmoji(user: Ranking): string {
  if (user.reaction === "ANGRY") return "😡";
  if (user.reaction === "CAT") return "😺";
  if (user.reaction === "EYES") return "👀";
  if (user.reaction === "FLEX") return "💪";
  if (user.reaction === "POOP") return "💩";
  if (user.reaction === "POPCORN") return "🍿";
  if (user.reaction === "POPPER") return "🎉";
  if (user.reaction === "SUNGLASSES") return "😎";
  if (user.reaction.startsWith("TROPHY")) return "🏆";
  if (user.reaction.startsWith("YEAR_IN_REVIEW")) return "💫";
  if (user.reaction.startsWith("FLAG")) {
    return languageEmoji(user.reaction.split(",")[1] ?? "");
  }
  return "";
}
