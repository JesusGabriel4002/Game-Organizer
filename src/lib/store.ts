import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";
export type ViewMode = "table" | "board" | "gallery";

/** Table columns after "Nome", which is always first. */
export const DEFAULT_TABLE_COLUMNS = ["status", "completion", "categories", "timeToBeat"];

interface UiState {
  theme: Theme;
  viewMode: ViewMode;
  sidebarCollapsed: boolean;
  tableColumns: string[];
  setTheme: (theme: Theme) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleSidebar: () => void;
  setTableColumns: (columns: string[]) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: "system",
      viewMode: "table",
      sidebarCollapsed: false,
      tableColumns: DEFAULT_TABLE_COLUMNS,
      setTheme: (theme) => set({ theme }),
      setViewMode: (viewMode) => set({ viewMode }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setTableColumns: (tableColumns) => set({ tableColumns }),
    }),
    { name: "game-organizer-ui" },
  ),
);

interface PaletteState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const usePalette = create<PaletteState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
