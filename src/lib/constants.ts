import type { GameStatus, TagColor } from "./types";

export const STATUS_META: Record<GameStatus, { label: string; color: TagColor; dot: string }> = {
  backlog: { label: "Pra zerar", color: "orange", dot: "bg-[#d9730d]" },
  playing: { label: "Jogando", color: "blue", dot: "bg-[#2383e2]" },
  completed: { label: "Zerado", color: "green", dot: "bg-[#4dab9a]" },
};

export const TAG_COLORS: Record<TagColor, { label: string; tag: string; dot: string }> = {
  gray: { label: "Cinza", tag: "bg-[#e3e2e0] text-[#32302c] dark:bg-[#5a5a5a] dark:text-[#ededed]", dot: "bg-[#9b9a97]" },
  brown: { label: "Marrom", tag: "bg-[#eee0da] text-[#442a1e] dark:bg-[#603b2c] dark:text-[#f0e0d8]", dot: "bg-[#937264]" },
  orange: { label: "Laranja", tag: "bg-[#fadec9] text-[#49290e] dark:bg-[#854c1d] dark:text-[#fbe3cf]", dot: "bg-[#d9730d]" },
  yellow: { label: "Amarelo", tag: "bg-[#fdecc8] text-[#402c1b] dark:bg-[#89632a] dark:text-[#fbefd0]", dot: "bg-[#dfab01]" },
  green: { label: "Verde", tag: "bg-[#dbeddb] text-[#1c3829] dark:bg-[#2b593f] dark:text-[#d9f0e1]", dot: "bg-[#4dab9a]" },
  blue: { label: "Azul", tag: "bg-[#d3e5ef] text-[#183347] dark:bg-[#28456c] dark:text-[#d6e6f5]", dot: "bg-[#2383e2]" },
  purple: { label: "Roxo", tag: "bg-[#e8deee] text-[#412454] dark:bg-[#492f64] dark:text-[#ead9f5]", dot: "bg-[#9065b0]" },
  pink: { label: "Rosa", tag: "bg-[#f5e0e9] text-[#4c2337] dark:bg-[#69314c] dark:text-[#f7dbe8]", dot: "bg-[#c14c8a]" },
  red: { label: "Vermelho", tag: "bg-[#ffe2dd] text-[#5d1715] dark:bg-[#6e3630] dark:text-[#fbdcd8]", dot: "bg-[#e03e3e]" },
};

export const COMMON_PLATFORMS = ["PC", "Steam Deck", "PS5", "PS4", "Xbox Series", "Xbox One", "Switch", "Switch 2", "Mobile", "Emulador"];

export const TAG_COLOR_KEYS = Object.keys(TAG_COLORS) as TagColor[];

export function randomTagColor(): TagColor {
  const options = TAG_COLOR_KEYS.filter((c) => c !== "gray");
  return options[Math.floor(Math.random() * options.length)];
}
