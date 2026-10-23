import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, KeyRound, Library, Loader2, PenLine, Search, Settings, Tags, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { igdb } from "@/lib/api";
import { STATUS_META } from "@/lib/constants";
import { useAddFromIgdb, useAddManual, useLibrary } from "@/lib/queries";
import { usePalette } from "@/lib/store";
import { toast } from "@/lib/toast";
import { STATUSES, type CompletionInput, type GameStatus, type IgdbGame } from "@/lib/types";
import { cn, errorMessage } from "@/lib/utils";
import { CompletionEditor } from "@/components/game/completion-field";
import { Cover } from "@/components/game/cover";

function emptyCompletion(): CompletionInput {
  return { year: new Date().getFullYear(), startedAt: null, completedAt: null };
}
import { StatusTag } from "@/components/game/tags";

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

const itemClass =
  "flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent-strong [&>svg]:size-4 [&>svg]:text-muted-foreground";
const groupClass =
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground";

export function CommandPalette() {
  const { open, setOpen } = usePalette();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<GameStatus>("backlog");
  const [completion, setCompletion] = useState<CompletionInput>(emptyCompletion);
  const debounced = useDebounced(query.trim(), 350);
  const { data: library = [] } = useLibrary();
  const addFromIgdb = useAddFromIgdb();
  const addManual = useAddManual();

  const igdbStatus = useQuery({ queryKey: ["igdb-status"], queryFn: igdb.status, enabled: open, staleTime: 0 });
  const configured = igdbStatus.data?.configured ?? false;

  const search = useQuery({
    queryKey: ["igdb-search", debounced],
    queryFn: () => igdb.search(debounced),
    enabled: open && configured && debounced.length >= 2,
    staleTime: 5 * 60_000,
  });
  const popular = useQuery({
    queryKey: ["igdb-popular"],
    queryFn: igdb.popular,
    enabled: open && configured,
    staleTime: 6 * 60 * 60_000,
  });

  useEffect(() => {
    if (!open) {
      setQuery("");
      setCompletion(emptyCompletion());
    }
  }, [open]);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const q = query.trim().toLowerCase();
  const localMatches = q ? library.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 5) : [];

  const finished = status === "completed" ? completion : undefined;
  const addedAs = finished ? `zerado em ${finished.year}` : `em "${STATUS_META[status].label}"`;

  const addIgdb = async (game: IgdbGame) => {
    try {
      const { id, existed } = await addFromIgdb.mutateAsync({ game, status, completion: finished });
      toast.info(existed ? `${game.name} já estava na biblioteca.` : `${game.name} adicionado ${addedAs}.`);
      go(`/game/${id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const addCustom = async () => {
    const name = query.trim();
    if (!name) return;
    const id = await addManual.mutateAsync({ name, status, completion: finished });
    toast.info(`${name} adicionado manualmente ${addedAs}.`);
    go(`/game/${id}`);
  };

  const igdbItem = (g: IgdbGame) => (
    <Command.Item key={g.igdbId} value={`igdb-${g.igdbId}`} onSelect={() => addIgdb(g)} className={itemClass}>
      <Cover url={g.coverUrl} name={g.name} className="h-12 w-9 shrink-0 rounded-sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          {g.name}
          {g.releaseYear && <span className="ml-1.5 font-normal text-muted-foreground">{g.releaseYear}</span>}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {[g.genres.slice(0, 3).join(", "), g.platforms.slice(0, 4).join(", ")].filter(Boolean).join(" · ")}
        </div>
      </div>
    </Command.Item>
  );

  const navItems = [
    { label: "Todos os jogos", icon: <Library />, path: "/" },
    { label: "Metas", icon: <Target />, path: "/goals" },
    { label: "Estatísticas", icon: <BarChart3 />, path: "/stats" },
    { label: "Categorias", icon: <Tags />, path: "/categories" },
    { label: "Configurações", icon: <Settings />, path: "/settings" },
  ];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[10vh] z-50 w-full max-w-2xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl focus:outline-none">
          <DialogPrimitive.Title className="sr-only">Buscar e adicionar jogos</DialogPrimitive.Title>
          <Command shouldFilter={false} loop>
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="size-4 text-muted-foreground" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Buscar um jogo para adicionar..."
                className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
              />
              {search.isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            </div>

            <div className="flex items-center gap-1 border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
              Adicionar como:
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn("rounded px-1 py-0.5", status === s ? "bg-accent-strong" : "opacity-60 hover:opacity-100")}
                >
                  <StatusTag status={s} />
                </button>
              ))}
            </div>

            {status === "completed" && (
              // Keeps Enter inside the date/year inputs from selecting a result in the list.
              <div className="border-b border-border px-3 py-2" onKeyDown={(e) => e.stopPropagation()}>
                <CompletionEditor
                  value={completion}
                  onChange={(change) => setCompletion((prev) => ({ ...prev, ...change, year: change.year ?? prev.year }))}
                />
              </div>
            )}

            <Command.List className="max-h-[55vh] overflow-y-auto p-1.5">
              {!q && popular.data && popular.data.length > 0 && (
                <Command.Group heading="Jogos populares" className={groupClass}>
                  {popular.data.slice(0, 10).map(igdbItem)}
                </Command.Group>
              )}

              {!q && (
                <Command.Group heading="Navegar" className={groupClass}>
                  {navItems.map((n) => (
                    <Command.Item key={n.path} value={`nav-${n.path}`} onSelect={() => go(n.path)} className={itemClass}>
                      {n.icon}
                      {n.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {localMatches.length > 0 && (
                <Command.Group heading="Na sua biblioteca" className={groupClass}>
                  {localMatches.map((e) => (
                    <Command.Item key={e.id} value={`local-${e.id}`} onSelect={() => go(`/game/${e.id}`)} className={itemClass}>
                      <Cover url={e.coverUrl} name={e.name} className="h-9 w-7 shrink-0 rounded-sm" />
                      <span className="flex-1 truncate">{e.name}</span>
                      <StatusTag status={e.status} />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {q && !configured && igdbStatus.isSuccess && (
                <Command.Group heading="IGDB" className={groupClass}>
                  <Command.Item value="configure-igdb" onSelect={() => go("/settings")} className={itemClass}>
                    <KeyRound />
                    Busca do IGDB indisponível no momento. Ver configurações
                  </Command.Item>
                </Command.Group>
              )}

              {search.isError && (
                <p className="px-2 py-2 text-sm text-destructive">{errorMessage(search.error)}</p>
              )}

              {search.data && search.data.length > 0 && (
                <Command.Group heading="Resultados do IGDB" className={groupClass}>
                  {search.data.map(igdbItem)}
                </Command.Group>
              )}

              {q && (
                <Command.Group heading="Manual" className={groupClass}>
                  <Command.Item value="manual-add" onSelect={addCustom} className={itemClass}>
                    <PenLine />
                    Adicionar “{query.trim()}” manualmente
                  </Command.Item>
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
