import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { completionLabel } from "@/lib/completion";
import { formatTimeToBeat } from "@/lib/igdb-info";
import { useCategories, useGoals, useLibrary, useSessions } from "@/lib/queries";
import type { LibraryEntry } from "@/lib/types";
import { Select } from "@/components/ui/input";
import { EmptyState, PageContainer, PageHeader } from "@/components/layout/page";
import { Cover } from "@/components/game/cover";
import { formatMinutes } from "@/features/library/play-sessions";
import { buildRecap, MONTH_NAMES, recapYears } from "./recap";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

function Big({ value, label, sub }: { value: React.ReactNode; label: string; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-5">
      <div className="text-4xl font-bold tabular-nums tracking-tight">{value}</div>
      <div className="mt-1 text-sm font-medium">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Highlight({ title, entry, detail }: { title: string; entry: LibraryEntry; detail?: string | null }) {
  return (
    <Link to={`/game/${entry.id}`} className="flex items-center gap-3 rounded-xl border border-border p-3 transition hover:bg-accent/50">
      <Cover url={entry.coverUrl} name={entry.name} className="h-20 w-[60px] shrink-0 rounded-md" />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="truncate font-semibold">{entry.name}</div>
        {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
      </div>
    </Link>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-semibold">{value}</div>
    </div>
  );
}

export function RecapPage() {
  const { data: library = [] } = useLibrary();
  const { data: sessions = [] } = useSessions();
  const { data: categories = [] } = useCategories();
  const { data: goals = [] } = useGoals();
  const years = useMemo(() => recapYears(library, sessions), [library, sessions]);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const recap = useMemo(() => buildRecap(year, library, sessions, categories, goals), [year, library, sessions, categories, goals]);

  const diff = recap.completed.length - recap.previousYearCount;
  const comparison =
    recap.previousYearCount === 0
      ? null
      : diff === 0
        ? `O mesmo que em ${year - 1}`
        : `${diff > 0 ? "+" : ""}${diff} em relação a ${year - 1}`;
  const empty = recap.completed.length === 0 && recap.sessionCount === 0 && recap.started === 0;

  return (
    <PageContainer wide>
      <PageHeader
        icon="✨"
        title={`Retrospectiva ${year}`}
        description="Seu ano nos games, a partir dos jogos zerados, das sessões registradas e das metas."
        actions={
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        }
      />

      {empty ? (
        <EmptyState title={`Nada registrado em ${year} ainda`}>
          Marque jogos como zerados ou registre sessões de jogo para montar a retrospectiva.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Big value={recap.completed.length} label={recap.completed.length === 1 ? "jogo zerado" : "jogos zerados"} sub={comparison} />
            <Big
              value={recap.sessionMinutes ? fmt(recap.sessionMinutes / 60) : fmt(recap.estimatedHours)}
              label="horas jogadas"
              sub={
                recap.sessionMinutes
                  ? `${recap.sessionCount} ${recap.sessionCount === 1 ? "sessão" : "sessões"} em ${recap.daysPlayed} ${recap.daysPlayed === 1 ? "dia" : "dias"}`
                  : "estimativa pela média do IGDB dos zerados"
              }
            />
            <Big value={recap.started} label={recap.started === 1 ? "jogo começado" : "jogos começados"} />
            <Big
              value={recap.goals.total ? `${recap.goals.done}/${recap.goals.total}` : "–"}
              label="metas cumpridas"
              sub={recap.goals.total ? undefined : `Nenhuma meta com prazo em ${year}`}
            />
          </div>

          {recap.completed.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold">Zerados em {year}, em ordem</h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
                {recap.completed.map((e, i) => (
                  <Link key={e.id} to={`/game/${e.id}`} className="group" title={e.name}>
                    <div className="relative">
                      <Cover url={e.coverUrl} name={e.name} className="aspect-[3/4] w-full rounded-md border border-border transition group-hover:opacity-80" />
                      <span className="absolute left-1 top-1 rounded bg-background/80 px-1 text-[11px] font-semibold tabular-nums">
                        {i + 1}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs">{e.name}</p>
                    <p className="text-[11px] text-muted-foreground">{completionLabel(e, new Date(year, 0, 1)) ?? ""}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {recap.favorite && <Highlight title="Favorito do ano" entry={recap.favorite} detail={`${recap.favorite.rating}/5 estrelas`} />}
            {recap.mostPlayed && (
              <Highlight title="Mais tempo em sessões" entry={recap.mostPlayed.entry} detail={formatMinutes(recap.mostPlayed.minutes)} />
            )}
            {recap.longest && <Highlight title="O mais longo" entry={recap.longest} detail={formatTimeToBeat(recap.longest.timeToBeat)} />}
            {recap.shortest && <Highlight title="O mais rápido" entry={recap.shortest} detail={formatTimeToBeat(recap.shortest.timeToBeat)} />}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recap.bestMonth && (
              <Fact
                label="Mês mais produtivo"
                value={`${MONTH_NAMES[recap.bestMonth.month]} (${recap.bestMonth.count} ${recap.bestMonth.count === 1 ? "zerado" : "zerados"})`}
              />
            )}
            {recap.topCategory && <Fact label="Categoria do ano" value={`${recap.topCategory.name} (${recap.topCategory.count})`} />}
            {recap.topGenre && <Fact label="Gênero do ano" value={`${recap.topGenre.name} (${recap.topGenre.count})`} />}
            {recap.topPlatform && <Fact label="Plataforma do ano" value={`${recap.topPlatform.name} (${recap.topPlatform.count})`} />}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
