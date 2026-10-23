import type { TagColor } from "./types";

/**
 * Built-in categories derived from IGDB data. Tags are the lower-cased keywords, genres, themes,
 * game modes and perspectives IGDB returns; keywords are community-made, so rules list the
 * common spellings and `titles` covers well-known games that lack the keyword.
 */
export interface CategoryRule {
  name: string;
  color: TagColor;
  /** Matches when the game has at least one of these tags. */
  any: string[];
  /** ...and all of these. */
  all?: string[];
  /** ...and none of these (IGDB themes are noisy, e.g. Terraria is tagged "horror"). */
  none?: string[];
  /** Lower-cased name fragments that match regardless of tags. */
  titles?: string[];
}

export const CATEGORY_RULES: CategoryRule[] = [
  {
    name: "Soulslike",
    color: "red",
    any: ["soulslike", "souls-like", "souls like", "soulslite", "souls-lite"],
    titles: [
      "dark souls", "demon's souls", "elden ring", "sekiro", "bloodborne", "nioh", "lies of p", "lords of the fallen",
      "mortal shell", "the surge", "code vein", "black myth: wukong", "wo long", "thymesia", "salt and sanctuary", "remnant",
    ],
  },
  { name: "Metroidvania", color: "purple", any: ["metroidvania", "metroidvania-like", "search action"] },
  { name: "Roguelike", color: "orange", any: ["roguelike", "roguelite", "rogue-lite", "rogue-like", "roguelike deckbuilder"] },
  { name: "Survivors-like", color: "orange", any: ["bullet heaven", "survivors-like", "survivorslike", "reverse bullet hell"] },
  {
    name: "Cozy",
    color: "pink",
    any: ["cozy", "cosy", "wholesome", "relaxing", "life simulation", "farming", "farming sim", "farming simulation", "social simulation"],
    none: ["horror", "survival horror", "psychological horror"],
    titles: [
      "stardew valley", "animal crossing", "spiritfarer", "unpacking", "a short hike", "story of seasons", "harvest moon",
      "cozy grove", "coral island", "fae farm", "slime rancher", "ooblets", "dorfromantik", "wylde flowers", "sun haven",
    ],
  },
  {
    name: "JRPG",
    color: "blue",
    any: ["jrpg", "japanese rpg", "japanese role-playing game"],
    titles: [
      "persona ", "final fantasy", "dragon quest", "tales of ", "xenoblade", "like a dragon", "shin megami tensei",
      "octopath traveler", "kingdom hearts", "ni no kuni", "fire emblem", "trails of", "the legend of heroes",
    ],
  },
  {
    name: "RPG por turnos",
    color: "blue",
    any: ["turn-based rpg", "party-based rpg", "turn-based combat", "turn-based tactics", "crpg"],
    all: ["role-playing (rpg)"],
  },
  { name: "Survival horror", color: "red", any: ["survival horror", "psychological horror"] },
  { name: "Terror", color: "gray", any: ["horror"], none: ["sandbox", "comedy", "cozy", "wholesome"] },
  {
    name: "Sobrevivência",
    color: "green",
    any: ["crafting", "base building", "open world survival craft", "survival craft"],
    all: ["survival"],
  },
  { name: "Sandbox", color: "yellow", any: ["sandbox"] },
  { name: "Mundo aberto", color: "green", any: ["open world"], none: ["side view", "2d", "bird view / isometric"] },
  { name: "Plataforma", color: "yellow", any: ["platform", "2d platformer", "3d platformer", "precision platformer"] },
  { name: "Hack and slash", color: "orange", any: ["hack and slash/beat 'em up"] },
  { name: "FPS", color: "gray", any: ["shooter"], all: ["first person"] },
  { name: "Stealth", color: "gray", any: ["stealth"] },
  { name: "Luta", color: "red", any: ["fighting"] },
  { name: "Corrida", color: "blue", any: ["racing"] },
  { name: "Esportes", color: "green", any: ["sport"] },
  {
    name: "Estratégia",
    color: "brown",
    any: [
      "real time strategy (rts)", "turn-based strategy (tbs)", "4x (explore, expand, exploit, and exterminate)",
      "grand strategy", "tower defense", "city builder", "city-builder",
    ],
    none: ["card & board game", "role-playing (rpg)"],
  },
  {
    name: "Cartas e deckbuilding",
    color: "purple",
    any: ["deck-building", "deckbuilding", "deckbuilder", "deck building", "card & board game"],
  },
  { name: "Puzzle", color: "yellow", any: ["puzzle"], none: ["survival horror", "shooter", "role-playing (rpg)"] },
  { name: "Point-and-click", color: "brown", any: ["point-and-click", "point and click"] },
  {
    name: "Narrativo",
    color: "brown",
    any: ["story rich", "story driven", "narrative", "choices matter", "visual novel", "interactive fiction", "multiple-choice interactive fiction"],
  },
  {
    name: "Co-op local",
    color: "green",
    any: ["split screen", "split-screen multiplayer", "local co-op", "couch co-op"],
    all: ["co-operative"],
  },
  { name: "Pixel art", color: "pink", any: ["pixel art", "pixel graphics", "pixel art game"] },
  { name: "Indies", color: "purple", any: ["indie"] },
];

export function matchCategories(name: string, tags: string[]): CategoryRule[] {
  const set = new Set(tags.map((t) => t.toLowerCase()));
  const title = name.toLowerCase();
  return CATEGORY_RULES.filter(
    (r) =>
      r.titles?.some((t) => title.includes(t)) ||
      (r.any.some((t) => set.has(t)) && (r.all ?? []).every((t) => set.has(t)) && !(r.none ?? []).some((t) => set.has(t))),
  );
}
