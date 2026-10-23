import { Check, Filter, Kanban, LayoutGrid, Plus, Search, Table2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { completionSortKey } from "@/lib/completion";
import { STATUS_META } from "@/lib/constants";
import { scoreOf } from "@/lib/igdb-info";
import { defaultLibrarySort } from "@/lib/library-sort";
import { useCategories, useLibrary } from "@/lib/queries";
import { usePalette, useUi, type ViewMode } from "@/lib/store";
import type { GameStatus, LibraryEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, PageContainer, PageHeader } from "@/components/layout/page";
import { Tag } from "@/components/game/tags";
import { TableView } from "./table-view";
import { BoardView } from "./board-view";
import { GalleryView } from "./gallery-view";

const VIEWS: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
  { mode: "table", label: "Tabela", icon: <Table2 /> },
  { mode: "board", label: "Board", icon: <Kanban /> },
  { mode: "gallery", label: "Galeria", icon: <LayoutGrid /> },
];

type SortKey = "default" | "updated" | "name" | "completed" | "rating";
const SORTS: Record<SortKey, { label: string; fn: (a: LibraryEntry, b: LibraryEntry) => number }> = {
  default: { label: "Padrão", fn: defaultLibrarySort },
  updated: { label: "Editados recentemente", fn: (a, b) => b.updatedAt.localeCompare(a.updatedAt) },
  name: { label: "Nome (A-Z)", fn: (a, b) => a.name.localeCompare(b.name, "pt-BR") },
  completed: { label: "Zerados recentemente", fn: (a, b) => completionSortKey(b).localeCompare(completionSortKey(a)) },
  rating: { label: "Maior nota", fn: (a, b) => (b.rating ?? -1) - (a.rating ?? -1) },
};

/** Gallery default: highest critic/IGDB score first (the badge on the cover). */
function galleryDefaultSort(a: LibraryEntry, b: LibraryEntry) {
  return (scoreOf(b) ?? -1) - (scoreOf(a) ?? -1) || a.name.localeCompare(b.name, "pt-BR");
}

function sortFn(sort: SortKey, viewMode: ViewMode) {
  if (sort === "default" && viewMode === "gallery") return galleryDefaultSort;
  return SORTS[sort].fn;
}

function sortLabel(sort: SortKey, viewMode: ViewMode) {
  if (sort === "default" && viewMode === "gallery") return "Nota da crítica";
  if (sort === "default") return "Status e tempo";
  return SORTS[sort].label;
}

const STATUS_ICONS: Record<GameStatus, string> = { backlog: "⏳", playing: "🎮", completed: "🏆" };

export function LibraryPage() {
  const { status, categoryId } = useParams<{ status?: GameStatus; categoryId?: string }>();
  const { data: library = [], isLoading, error } = useLibrary();
  const { data: categories = [] } = useCategories();
  const { viewMode, setViewMode } = useUi();
  const openPalette = usePalette((s) => s.setOpen);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("default");

  const category = categories.find((c) => c.id === categoryId);
  const platforms = useMemo(
    () => [...new Set(library.flatMap((e) => (e.platform ? [e.platform] : [])))].sort(),
    [library],
  );

  const entries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return library
      .filter((e) => !status || e.status === status)
      .filter((e) => !categoryId || e.categoryIds.includes(categoryId))
      .filter((e) => !categoryFilter.length || categoryFilter.every((id) => e.categoryIds.includes(id)))
      .filter((e) => !platformFilter || e.platform === platformFilter)
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .sort(sortFn(sort, viewMode));
  }, [library, status, categoryId, categoryFilter, platformFilter, search, sort, viewMode]);

  const title = status ? STATUS_META[status].label : category ? category.name : "Todos os jogos";
  const icon = status ? STATUS_ICONS[status] : category ? "🏷️" : "📚";
  const toggleCategory = (id: string) =>
    setCategoryFilter((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  const hasFilters = !!(search || categoryFilter.length || platformFilter);

  return (
    <PageContainer wide>
      <PageHeader
        icon={icon}
        title={title}
        description={`${entries.length} ${entries.length === 1 ? "jogo" : "jogos"}`}
        actions={
          <Button variant="default" onClick={() => openPalette(true)}>
            <Plus /> Adicionar jogo
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-1 border-b border-border pb-2">
        {VIEWS.map((v) => (
          <Button
            key={v.mode}
            size="sm"
            variant="subtle"
            onClick={() => setViewMode(v.mode)}
            className={cn(viewMode === v.mode && "bg-accent-strong text-foreground")}
          >
            {v.icon}
            {v.label}
          </Button>
        ))}

        <div className="ml-auto flex items-center gap-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="h-7 w-44 rounded-md bg-transparent pl-7 pr-2 text-sm outline-none placeholder:text-muted-foreground hover:bg-accent focus:bg-accent"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="subtle" className={cn(hasFilters && "text-primary")}>
                <Filter /> Filtrar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-96 overflow-auto">
              <DropdownMenuLabel>Categorias</DropdownMenuLabel>
              {categories.length === 0 && <p className="px-2 py-1 text-sm text-muted-foreground">Nenhuma categoria</p>}
              {categories.map((c) => (
                <DropdownMenuItem key={c.id} onSelect={(e) => (e.preventDefault(), toggleCategory(c.id))}>
                  <Tag color={c.color}>{c.name}</Tag>
                  {categoryFilter.includes(c.id) && <Check className="ml-auto" />}
                </DropdownMenuItem>
              ))}
              {platforms.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Plataforma</DropdownMenuLabel>
                  {platforms.map((p) => (
                    <DropdownMenuItem key={p} onSelect={() => setPlatformFilter(platformFilter === p ? null : p)}>
                      {p}
                      {platformFilter === p && <Check className="ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="subtle">
                Ordenar: {sortLabel(sort, viewMode)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(SORTS) as SortKey[]).map((k) => (
                <DropdownMenuItem key={k} onSelect={() => setSort(k)}>
                  {SORTS[k].label}
                  {sort === k && <Check className="ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {hasFilters && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-sm">
          {categoryFilter.map((id) => {
            const c = categories.find((x) => x.id === id);
            return c ? (
              <button key={id} onClick={() => toggleCategory(id)}>
                <Tag color={c.color}>
                  {c.name} <X className="size-3" />
                </Tag>
              </button>
            ) : null;
          })}
          {platformFilter && (
            <button onClick={() => setPlatformFilter(null)}>
              <Tag color="gray">
                {platformFilter} <X className="size-3" />
              </Tag>
            </button>
          )}
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setSearch("");
              setCategoryFilter([]);
              setPlatformFilter(null);
            }}
          >
            Limpar filtros
          </button>
        </div>
      )}

      {error ? (
        <EmptyState title="Não foi possível abrir o banco de dados">{String(error)}</EmptyState>
      ) : isLoading ? null : library.length === 0 ? (
        <EmptyState title="Sua biblioteca está vazia">
          Aperte <kbd className="rounded border border-border px-1">Ctrl K</kbd> para buscar e adicionar seu primeiro jogo.
        </EmptyState>
      ) : entries.length === 0 && viewMode !== "board" ? (
        <EmptyState title="Nenhum jogo encontrado">Ajuste os filtros ou adicione um jogo novo.</EmptyState>
      ) : viewMode === "table" ? (
        <TableView entries={entries} platforms={platforms} completedOnly={status === "completed"} />
      ) : viewMode === "board" ? (
        <BoardView entries={entries} />
      ) : (
        <GalleryView entries={entries} />
      )}
    </PageContainer>
  );
}
