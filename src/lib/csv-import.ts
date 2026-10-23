import { igdb } from "./api";
import * as db from "./db";
import type { EntryPatch, GameStatus } from "./types";
import { errorMessage } from "./utils";

export const CSV_TEMPLATE = [
  "nome;status;ano;plataforma;nota;horas",
  "Hollow Knight;zerado;2024;PC;9;45",
  "Elden Ring;jogando;;PS5;;",
  "Stardew Valley;pra zerar;2026;;;",
  "Celeste;;;;;",
].join("\r\n");

export interface CsvRow {
  name: string;
  status: GameStatus | null;
  year: number | null;
  platform: string | null;
  rating: number | null;
  hours: number | null;
}

export type ImportOutcome = "added" | "manual" | "existing" | "failed";

export interface ImportResult {
  row: CsvRow;
  outcome: ImportOutcome;
  /** IGDB name when it differs from the name in the file. */
  matchedName?: string;
  error?: string;
}

/** Keeps us at ~2 searches per second, well under IGDB's 4/s shared by every user of the proxy. */
const SEARCH_INTERVAL_MS = 500;
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000];

const COLUMN_ALIASES: Record<keyof CsvRow, string[]> = {
  name: ["nome", "jogo", "name", "game", "titulo", "title"],
  status: ["status", "situacao", "estado"],
  year: ["ano", "year"],
  platform: ["plataforma", "platform", "console"],
  rating: ["nota", "rating", "score"],
  hours: ["horas", "hours", "tempo"],
};

const STATUS_ALIASES: Record<GameStatus, string[]> = {
  backlog: ["pra zerar", "para zerar", "a zerar", "zerar", "quero zerar", "backlog", "wishlist", "fila"],
  playing: ["jogando", "playing", "em andamento", "comecei"],
  completed: ["zerado", "zerei", "completed", "finalizado", "terminado", "concluido", "done", "beat"],
};

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function detectSeparator(firstLine: string) {
  const counts = [";", ",", "\t"].map((sep) => [sep, firstLine.split(sep).length] as const);
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

/** RFC 4180 style: quoted fields may contain the separator, line breaks and "" escapes. */
function splitCsv(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  rows.push(row);
  return rows.map((r) => r.map((f) => f.trim())).filter((r) => r.some((f) => f));
}

function parseStatus(value: string): GameStatus | null {
  const v = normalize(value);
  if (!v) return null;
  for (const [status, aliases] of Object.entries(STATUS_ALIASES) as [GameStatus, string[]][]) {
    if (aliases.includes(v)) return status;
  }
  return null;
}

function parseNumber(value: string, min: number, max: number) {
  const n = Number(value.replace(",", "."));
  return value && Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/** A file without a recognised header is read as one game name per line (first column). */
export function parseCsv(text: string): CsvRow[] {
  const clean = text.replace(/^\uFEFF/, "");
  const rows = splitCsv(clean, detectSeparator(clean.split(/\r?\n/, 1)[0] ?? ""));
  if (!rows.length) return [];

  const header = rows[0].map(normalize);
  const index = Object.fromEntries(
    (Object.keys(COLUMN_ALIASES) as (keyof CsvRow)[]).map((key) => [key, header.findIndex((h) => COLUMN_ALIASES[key].includes(h))]),
  ) as Record<keyof CsvRow, number>;
  const hasHeader = index.name >= 0;
  if (!hasHeader) index.name = 0;

  const cell = (r: string[], key: keyof CsvRow) => (index[key] >= 0 ? (r[index[key]] ?? "") : "");
  const maxYear = new Date().getFullYear() + 20;
  return (hasHeader ? rows.slice(1) : rows)
    .map((r) => ({
      name: cell(r, "name"),
      status: parseStatus(cell(r, "status")),
      year: parseNumber(cell(r, "year"), 1970, maxYear),
      platform: cell(r, "platform") || null,
      rating: parseNumber(cell(r, "rating"), 0, 10),
      hours: parseNumber(cell(r, "hours"), 0, 100_000),
    }))
    .filter((r) => r.name);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function searchWithRetry(name: string, signal: AbortSignal) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await igdb.search(name);
    } catch (err) {
      if (attempt >= RETRY_DELAYS_MS.length || signal.aborted) throw err;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

async function addRow(row: CsvRow, signal: AbortSignal, lastSearch: { at: number }): Promise<ImportResult> {
  const status = row.status ?? "backlog";
  const options = {
    completion: status === "completed" && row.year ? { year: row.year, startedAt: null, completedAt: null } : undefined,
    targetYear: status === "backlog" ? row.year : null,
  };

  const wait = lastSearch.at + SEARCH_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastSearch.at = Date.now();
  const results = await searchWithRetry(row.name, signal);

  let id: string;
  let outcome: ImportOutcome;
  let matchedName: string | undefined;
  const game = results.find((g) => normalize(g.name) === normalize(row.name)) ?? results[0];
  if (game) {
    const added = await db.addFromIgdb(game, status, options);
    if (added.existed) return { row, outcome: "existing" };
    id = added.id;
    outcome = "added";
    if (normalize(game.name) !== normalize(row.name)) matchedName = game.name;
  } else {
    id = await db.addManual(row.name, status, options);
    outcome = "manual";
  }

  const patch: EntryPatch = {};
  if (row.platform) patch.platform = row.platform;
  if (row.rating !== null) patch.rating = row.rating;
  if (row.hours !== null) patch.hours = row.hours;
  // Without a year, "today" would be a made-up completion date for an old game.
  if (status === "completed" && !row.year) Object.assign(patch, { startedAt: null, completedYear: null, completedAt: null });
  if (Object.keys(patch).length) await db.updateEntry(id, patch);
  return { row, outcome, matchedName };
}

/** Imports one row at a time so IGDB searches stay under the rate limit. */
export async function importCsvRows(
  rows: CsvRow[],
  onProgress: (done: number, result: ImportResult) => void,
  signal: AbortSignal,
): Promise<ImportResult[]> {
  const library = await db.listLibrary();
  const known = new Set(library.map((e) => normalize(e.name)));
  const results: ImportResult[] = [];
  const lastSearch = { at: 0 };

  for (const row of rows) {
    if (signal.aborted) break;
    let result: ImportResult;
    if (known.has(normalize(row.name))) {
      result = { row, outcome: "existing" };
    } else {
      try {
        result = await addRow(row, signal, lastSearch);
      } catch (err) {
        result = { row, outcome: "failed", error: errorMessage(err) };
      }
    }
    known.add(normalize(row.name));
    if (result.matchedName) known.add(normalize(result.matchedName));
    results.push(result);
    onProgress(results.length, result);
  }
  return results;
}
