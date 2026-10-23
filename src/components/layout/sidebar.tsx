import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  CircleCheck,
  CirclePlay,
  Hourglass,
  Library,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Tags,
  Target,
} from "lucide-react";
import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { TAG_COLORS } from "@/lib/constants";
import { useCategories, useLibrary } from "@/lib/queries";
import { usePalette, useUi } from "@/lib/store";
import type { GameStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

function Item({
  to,
  icon,
  label,
  count,
  end,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "group flex h-7 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent [&_svg]:size-4 [&_svg]:shrink-0",
          isActive && "bg-accent-strong font-medium text-foreground",
        )
      }
    >
      {icon}
      <span className="truncate">{label}</span>
      {count !== undefined && count > 0 && <span className="ml-auto text-xs text-muted-foreground">{count}</span>}
    </NavLink>
  );
}

const SIDEBAR_CATEGORY_LIMIT = 5;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 mt-4 px-2 text-xs font-medium text-muted-foreground">{children}</div>;
}

export function Sidebar() {
  const { data: library = [] } = useLibrary();
  const { data: categories = [] } = useCategories();
  const { theme, setTheme, sidebarCollapsed, toggleSidebar } = useUi();
  const setPaletteOpen = usePalette((s) => s.setOpen);

  const [showAllCategories, setShowAllCategories] = useState(false);

  const count = (status: GameStatus) => library.filter((e) => e.status === status).length;
  const rankedCategories = useMemo(
    () =>
      categories
        .map((category) => ({ category, count: library.filter((e) => e.categoryIds.includes(category.id)).length }))
        .sort((a, b) => b.count - a.count || a.category.name.localeCompare(b.category.name, "pt-BR")),
    [categories, library],
  );
  const visibleCategories = showAllCategories ? rankedCategories : rankedCategories.slice(0, SIDEBAR_CATEGORY_LIMIT);
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (sidebarCollapsed) {
    return (
      <aside className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-border bg-sidebar py-3">
        <button onClick={toggleSidebar} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" title="Expandir">
          <ChevronsRight className="size-4" />
        </button>
        <button onClick={() => setPaletteOpen(true)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" title="Buscar (Ctrl+K)">
          <Search className="size-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex h-12 items-center gap-2 px-3">
        <img src="/icon.svg" alt="" className="size-5 rounded" />
        <span className="flex-1 truncate text-sm font-semibold">Game Organizer</span>
        <button onClick={toggleSidebar} className="rounded-md p-1 text-muted-foreground hover:bg-accent" title="Recolher">
          <ChevronsLeft className="size-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        <button
          onClick={() => setPaletteOpen(true)}
          className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent"
        >
          <Search className="size-4" />
          Buscar e adicionar
          <kbd className="ml-auto text-[11px] text-muted-foreground">Ctrl K</kbd>
        </button>

        <SectionLabel>Biblioteca</SectionLabel>
        <Item to="/" end icon={<Library />} label="Todos os jogos" count={library.length} />
        <Item to="/status/playing" icon={<CirclePlay />} label="Jogando" count={count("playing")} />
        <Item to="/status/backlog" icon={<Hourglass />} label="Pra zerar" count={count("backlog")} />
        <Item to="/status/completed" icon={<CircleCheck />} label="Zerados" count={count("completed")} />

        <SectionLabel>Acompanhamento</SectionLabel>
        <Item to="/goals" icon={<Target />} label="Metas" />
        <Item to="/stats" icon={<BarChart3 />} label="Estatísticas" />

        <div className="group/cat mb-1 mt-4 flex items-center px-2">
          <span className="flex-1 text-xs font-medium text-muted-foreground">Categorias</span>
          <NavLink to="/categories" className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-accent group-hover/cat:opacity-100" title="Gerenciar categorias">
            <Plus className="size-3.5" />
          </NavLink>
        </div>
        {visibleCategories.map(({ category: c, count }) => (
          <Item
            key={c.id}
            to={`/category/${c.id}`}
            icon={<span className={cn("ml-1 mr-1 size-2 rounded-full", TAG_COLORS[c.color].dot)} />}
            label={c.name}
            count={count}
          />
        ))}
        {rankedCategories.length > SIDEBAR_CATEGORY_LIMIT && (
          <button
            onClick={() => setShowAllCategories((v) => !v)}
            className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent [&_svg]:size-4"
          >
            {showAllCategories ? <ChevronUp /> : <ChevronDown />}
            {showAllCategories ? "Mostrar menos" : `Mostrar mais (${rankedCategories.length - SIDEBAR_CATEGORY_LIMIT})`}
          </button>
        )}
        <Item to="/categories" icon={<Tags />} label="Gerenciar categorias" />
      </nav>

      <div className="border-t border-border p-2">
        <Item to="/settings" icon={<Settings />} label="Configurações" />
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent"
          title={`Tema atual: ${theme}`}
        >
          {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {isDark ? "Tema claro" : "Tema escuro"}
        </button>
      </div>
    </aside>
  );
}
