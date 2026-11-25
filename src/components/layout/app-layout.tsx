import { useEffect, useState } from "react";
import { Menu, Search } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { Outlet, useLocation } from "react-router-dom";
import { useIsNarrow } from "@/lib/use-media";
import { useIgdbSync } from "@/lib/queries";
import { useCoverCache } from "@/lib/covers";
import { useGoalReminders } from "@/lib/goal-reminders";
import { useCloudSync } from "@/lib/use-cloud-sync";
import { useUi, usePalette } from "@/lib/store";
import { toast } from "@/lib/toast";
import { errorMessage, isMobile } from "@/lib/utils";
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
    // Not available on phones or outside Tauri; the app theme still applies.
    try {
      getCurrentWindow()
        .setTheme(theme === "system" ? null : theme)
        .catch(() => {});
    } catch {
      // ignore
    }
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
    // Phones update through a new APK/store build; the updater plugin only exists on desktop.
    if (import.meta.env.DEV || isMobile()) return;
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
  useCoverCache();
  useGoalReminders();
  useCloudSync();
  useAutoUpdate();
  const narrow = useIsNarrow();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const setPaletteOpen = usePalette((s) => s.setOpen);
  useEffect(() => setDrawerOpen(false), [location.pathname, narrow]);

  if (narrow) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-2 pt-[env(safe-area-inset-top)]">
          <button onClick={() => setDrawerOpen(true)} className="rounded-md p-2 text-muted-foreground hover:bg-accent" aria-label="Abrir menu">
            <Menu className="size-5" />
          </button>
          <img src="/icon.svg" alt="" className="size-5 rounded" />
          <span className="flex-1 truncate text-sm font-semibold">Game Organizer</span>
          <button onClick={() => setPaletteOpen(true)} className="rounded-md p-2 text-muted-foreground hover:bg-accent" aria-label="Buscar e adicionar">
            <Search className="size-5" />
          </button>
        </header>
        <main className="min-w-0 flex-1 overflow-auto pb-[env(safe-area-inset-bottom)]">
          <Outlet />
        </main>
        {drawerOpen && (
          <div className="fixed inset-0 z-40 flex">
            <Sidebar onClose={() => setDrawerOpen(false)} />
            <button className="flex-1 bg-black/40" aria-label="Fechar menu" onClick={() => setDrawerOpen(false)} />
          </div>
        )}
        <CommandPalette />
        <Toaster />
      </div>
    );
  }

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
