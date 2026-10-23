import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useIgdbSync } from "@/lib/queries";
import { useUi, usePalette } from "@/lib/store";
import { Sidebar } from "./sidebar";
import { Toaster } from "./toaster";
import { CommandPalette } from "@/features/search/command-palette";

function useThemeClass() {
  const theme = useUi((s) => s.theme);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
}

function usePaletteShortcut() {
  const setOpen = usePalette((s) => s.setOpen);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!usePalette.getState().open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
}

export function AppLayout() {
  useThemeClass();
  usePaletteShortcut();
  useIgdbSync();
  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-auto">
        <Outlet />
      </main>
      <CommandPalette />
      <Toaster />
    </div>
  );
}
