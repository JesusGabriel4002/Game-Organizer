import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { Outlet } from "react-router-dom";
import { useIgdbSync } from "@/lib/queries";
import { useCloudSync } from "@/lib/use-cloud-sync";
import { useUi, usePalette } from "@/lib/store";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/utils";
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
    // Windows title bar: null follows the system theme.
    getCurrentWindow()
      .setTheme(theme === "system" ? null : theme)
      .catch(() => {});
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

function useAutoUpdate() {
  useEffect(() => {
    if (import.meta.env.DEV) return;
    let cancelled = false;
    void (async () => {
      try {
        const update = await check();
        if (!update || cancelled) return;
        toast.info("Baixando atualização…");
        try {
          await update.downloadAndInstall();
          if (!cancelled) await relaunch();
        } catch (err) {
          if (!cancelled) toast.error(errorMessage(err));
        }
      } catch {
        // Sem rede ou sem manifesto: o app abre normal.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}

export function AppLayout() {
  useThemeClass();
  usePaletteShortcut();
  useIgdbSync();
  useCloudSync();
  useAutoUpdate();
  return (
    <div className="flex h-full overflow-hidden border-t border-border">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-auto">
        <Outlet />
      </main>
      <CommandPalette />
      <Toaster />
    </div>
  );
}
