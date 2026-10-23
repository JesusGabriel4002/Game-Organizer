import { invoke } from "@tauri-apps/api/core";
import type { IgdbGame, IgdbStatus } from "./types";

export const igdb = {
  status: () => invoke<IgdbStatus>("igdb_status"),
  saveCredentials: (clientId: string, clientSecret: string) =>
    invoke<void>("igdb_save_credentials", { clientId, clientSecret }),
  clearCredentials: () => invoke<void>("igdb_clear_credentials"),
  search: (query: string) => invoke<IgdbGame[]>("search_games", { query }),
};

export const files = {
  write: (path: string, contents: string) => invoke<void>("write_text_file", { path, contents }),
  read: (path: string) => invoke<string>("read_text_file", { path }),
};
