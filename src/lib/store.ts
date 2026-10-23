import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";
export type ViewMode = "table" | "board" | "gallery";

interface UiState {
  theme: Theme;
  viewMode: ViewMode;
  sidebarCollapsed: boolean;
  setTheme: (theme: Theme) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleSidebar: () => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: "system",
      viewMode: "table",
      sidebarCollapsed: false,
      setTheme: (theme) => set({ theme }),
      setViewMode: (viewMode) => set({ viewMode }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
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
