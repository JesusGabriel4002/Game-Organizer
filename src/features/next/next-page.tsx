import { Dices, Play, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatTimeToBeat } from "@/lib/igdb-info";
import { useCategories, useGoals, useLibrary, useUpdateEntry } from "@/lib/queries";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { EmptyState, PageContainer, PageHeader } from "@/components/layout/page";
import { Cover } from "@/components/game/cover";
import { ScoreBadge } from "@/components/game/score-badge";
import { CategoryTags, StatusTag } from "@/components/game/tags";
import { drawSuggestion, rankSuggestions, TIME_BUDGETS, type Suggestion, type SuggestFilters, type TimeBudget } from "./suggest";

function Reasons({ reasons }: { reasons: string[] }) {
  if (!reasons.length) return <p className="text-sm text-muted-foreground">Um bom candidato da sua lista.</p>;
  return (
    <ul className="space-y-0.5 text-sm text-muted-foreground">
      {reasons.map((r) => (
        <li key={r}>• {r}</li>
      ))}
    </ul>
  );
}

export function NextPage() {
  const navigate = useNavigate();
  const { data: library = [] } = useLibrary();
  const { data: goals = [] } = useGoals();
  const { data: categories = [] } = useCategories();
  const { mutate: updateEntry } = useUpdateEntry();
  const [filters, setFilters] = useState<SuggestFilters>({ budget: "any", categoryId: null, platform: null, includePlaying: false });
  const [drawn, setDrawn] = useState<Suggestion | null>(null);

  const ranked = useMemo(() => rankSuggestions(library, goals, filters), [library, goals, filters]);
  const platforms = useMemo(() => [...new Set(library.flatMap((e) => (e.platform ? [e.platform] : [])))].sort(), [library]);
  // A drawn game stays on top until filters change it out of the list.
  const top = (drawn && ranked.find((s) => s.entry.id === drawn.entry.id)) || ranked[0];
  const others = ranked.filter((s) => s !== top).slice(0, 6);
  const set = (patch: Partial<SuggestFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setDrawn(null);
  };

  const start = (s: Suggestion) => {
    if (s.entry.status !== "playing") {
      updateEntry({ entry: s.entry, patch: { status: "playing" } });
      toast.info(`${s.entry.name} agora está em "Jogando". Bom jogo!`);
    }
    navigate(`/game/${s.entry.id}`);
  };

  const hasBacklog = library.some((e) => e.status === "backlog" || e.status === "playing");

  return (
    <PageContainer wide>
      <PageHeader
        icon="🎲"
        title="O que jogar agora?"
        description="Sugestões da sua lista “Pra zerar”, considerando prazos, metas, nota da crítica e duração."
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Select value={filters.budget} onChange={(e) => set({ budget: e.target.value as TimeBudget })} className="w-48">
          {(Object.keys(TIME_BUDGETS) as TimeBudget[]).map((b) => (
            <option key={b} value={b}>
              {TIME_BUDGETS[b].label}
            </option>
          ))}
        </Select>
        <Select value={filters.categoryId ?? ""} onChange={(e) => set({ categoryId: e.target.value || null })} className="w-48">
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        {platforms.length > 0 && (
          <Select value={filters.platform ?? ""} onChange={(e) => set({ platform: e.target.value || null })} className="w-44">
            <option value="">Todas as plataformas</option>
            {platforms.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        )}
        <label className="flex items-center gap-1.5 px-1 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={filters.includePlaying}
            onChange={(e) => set({ includePlaying: e.target.checked })}
            className="accent-[var(--primary)]"
          />
          Incluir os que estou jogando
        </label>
      </div>

      {!hasBacklog ? (
        <EmptyState title="Nada na fila">Adicione jogos como “Pra zerar” para receber sugestões.</EmptyState>
      ) : !top ? (
        <EmptyState title="Nenhum jogo com esses filtros">
          Jogos sem tempo médio do IGDB não entram nos filtros de duração.
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-col gap-6 rounded-xl border border-border p-5 sm:flex-row">
            <Link to={`/game/${top.entry.id}`} className="relative shrink-0 self-start">
              <Cover url={top.entry.coverUrl} name={top.entry.name} className="h-64 w-48 rounded-lg border border-border shadow-lg" />
              <ScoreBadge entry={top.entry} />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" /> {drawn ? "Sorteado para você" : "Melhor sugestão"}
              </div>
              <Link to={`/game/${top.entry.id}`} className="text-2xl font-bold tracking-tight hover:underline">
                {top.entry.name}
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <StatusTag status={top.entry.status} />
                {top.entry.timeToBeat && (
                  <span className="text-sm text-muted-foreground">~{formatTimeToBeat(top.entry.timeToBeat)}</span>
                )}
                {top.entry.platform && <span className="text-sm text-muted-foreground">· {top.entry.platform}</span>}
              </div>
              <CategoryTags ids={top.entry.categoryIds} categories={categories} max={4} fit />
              <Reasons reasons={top.reasons} />
              {top.entry.summary && <p className="line-clamp-3 text-sm text-muted-foreground">{top.entry.summary}</p>}
              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                <Button variant="default" onClick={() => start(top)}>
                  <Play /> {top.entry.status === "playing" ? "Continuar" : "Começar a jogar"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDrawn(drawSuggestion(ranked, top.entry.id))}
                  disabled={ranked.length < 2}
                >
                  <Dices /> Sortear outro
                </Button>
              </div>
            </div>
          </div>

          {others.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-sm font-semibold">Outras boas opções</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((s) => (
                  <button
                    key={s.entry.id}
                    onClick={() => setDrawn(s)}
                    className="flex gap-3 rounded-lg border border-border p-3 text-left transition hover:bg-accent/50"
                  >
                    <Cover url={s.entry.coverUrl} name={s.entry.name} className="h-24 w-[72px] shrink-0 rounded-md" />
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-medium">{s.entry.name}</p>
                      {s.entry.timeToBeat && (
                        <p className="text-xs text-muted-foreground">~{formatTimeToBeat(s.entry.timeToBeat)}</p>
                      )}
                      <p className="line-clamp-2 text-xs text-muted-foreground">{s.reasons.slice(0, 2).join(" · ")}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </PageContainer>
  );
}
