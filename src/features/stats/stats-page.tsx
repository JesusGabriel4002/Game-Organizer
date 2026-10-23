import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCategories, useLibrary } from "@/lib/queries";
import { Select } from "@/components/ui/input";
import { EmptyState, PageContainer, PageHeader } from "@/components/layout/page";
import { Cover } from "@/components/game/cover";
import { completionSortKey, completionYear } from "@/lib/completion";
import { formatDate } from "@/features/goals/progress";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const PALETTE = ["#2383e2", "#4dab9a", "#d9730d", "#9065b0", "#e03e3e", "#dfab01", "#c14c8a", "#937264", "#9b9a97"];
const CATEGORY_HEX: Record<string, string> = {
  gray: "#9b9a97",
  brown: "#937264",
  orange: "#d9730d",
  yellow: "#dfab01",
  green: "#4dab9a",
  blue: "#2383e2",
  purple: "#9065b0",
  pink: "#c14c8a",
  red: "#e03e3e",
};

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function ChartBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      <div className="h-64">{children}</div>
    </div>
  );
}

const tooltipStyle = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 },
  labelStyle: { color: "var(--foreground)" },
  itemStyle: { color: "var(--foreground)" },
  cursor: { fill: "var(--accent)" },
};

export function StatsPage() {
  const { data: library = [] } = useLibrary();
  const { data: categories = [] } = useCategories();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const stats = useMemo(() => {
    const completed = library.filter((e) => e.status === "completed");
    const completedInYear = completed.filter((e) => completionYear(e) === year);
    const years = [...new Set([currentYear, ...completed.flatMap((e) => completionYear(e) ?? [])])].sort((a, b) => b - a);
    const perMonth = MONTHS.map((m, i) => ({
      month: m,
      jogos: completedInYear.filter((e) => e.completedAt && Number(e.completedAt.slice(5, 7)) === i + 1).length,
    }));
    const byCategory = categories
      .map((c) => ({ name: c.name, value: library.filter((e) => e.categoryIds.includes(c.id)).length, fill: CATEGORY_HEX[c.color] }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value);
    const platformCounts = new Map<string, number>();
    for (const e of library) if (e.platform) platformCounts.set(e.platform, (platformCounts.get(e.platform) ?? 0) + 1);
    const byPlatform = [...platformCounts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const rated = library.filter((e) => e.rating !== null);
    const avgRating = rated.length ? rated.reduce((s, e) => s + (e.rating ?? 0), 0) / rated.length : null;
    const hours = library.reduce((s, e) => s + (e.hours ?? 0), 0);
    const hoursInYear = completedInYear.reduce((s, e) => s + (e.hours ?? 0), 0);
    const topRated = [...rated].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 5);
    const recent = [...completedInYear].sort((a, b) => completionSortKey(b).localeCompare(completionSortKey(a))).slice(0, 8);
    return { completed, completedInYear, years, perMonth, byCategory, byPlatform, avgRating, hours, hoursInYear, topRated, recent };
  }, [library, categories, year, currentYear]);

  const count = (s: string) => library.filter((e) => e.status === s).length;
  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

  return (
    <PageContainer wide>
      <PageHeader
        icon="📊"
        title="Estatísticas"
        actions={
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
            {stats.years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        }
      />

      {library.length === 0 ? (
        <EmptyState title="Sem dados ainda">Adicione jogos para ver suas estatísticas.</EmptyState>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatCard label={`Zerados em ${year}`} value={stats.completedInYear.length} sub={`${fmt(stats.hoursInYear)} h jogadas`} />
            <StatCard label="Zerados (total)" value={stats.completed.length} />
            <StatCard label="Jogando" value={count("playing")} />
            <StatCard label="Pra zerar" value={count("backlog")} />
            <StatCard label="Horas registradas" value={fmt(stats.hours)} />
            <StatCard label="Nota média" value={stats.avgRating !== null ? `${fmt(stats.avgRating)}/10` : "–"} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartBox title={`Jogos zerados por mês em ${year}`}>
              <ResponsiveContainer>
                <BarChart data={stats.perMonth}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={24} stroke="var(--muted-foreground)" />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="jogos" fill="#2383e2" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>

            <ChartBox title="Jogos por categoria">
              {stats.byCategory.length ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={stats.byCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2} label={({ name }) => name}>
                      {stats.byCategory.map((c) => (
                        <Cell key={c.name} fill={c.fill} stroke="var(--background)" />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">Atribua categorias aos jogos para ver este gráfico.</p>
              )}
            </ChartBox>

            <ChartBox title="Jogos por plataforma">
              {stats.byPlatform.length ? (
                <ResponsiveContainer>
                  <BarChart data={stats.byPlatform} layout="vertical" margin={{ left: 10 }}>
                    <XAxis type="number" allowDecimals={false} hide />
                    <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} width={90} stroke="var(--muted-foreground)" />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="value" name="jogos" radius={[0, 4, 4, 0]}>
                      {stats.byPlatform.map((p, i) => (
                        <Cell key={p.name} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">Preencha a plataforma dos jogos para ver este gráfico.</p>
              )}
            </ChartBox>

            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-3 text-sm font-medium">Zerados recentemente em {year}</h3>
              {stats.recent.length ? (
                <ul className="space-y-1.5">
                  {stats.recent.map((e) => (
                    <li key={e.id}>
                      <Link to={`/game/${e.id}`} className="flex items-center gap-2.5 rounded-md p-1 hover:bg-accent">
                        <Cover url={e.coverUrl} name={e.name} className="h-9 w-7 rounded-sm" />
                        <span className="flex-1 truncate text-sm">{e.name}</span>
                        <span className="text-xs text-muted-foreground">{e.completedAt ? formatDate(e.completedAt) : "Data não informada"}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum jogo zerado em {year} ainda.</p>
              )}
              {stats.topRated.length > 0 && (
                <>
                  <h3 className="mb-2 mt-5 text-sm font-medium">Melhores notas</h3>
                  <ul className="space-y-1">
                    {stats.topRated.map((e) => (
                      <li key={e.id}>
                        <Link to={`/game/${e.id}`} className="flex items-center gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-accent">
                          <span className="flex-1 truncate">{e.name}</span>
                          <span className="tabular-nums text-muted-foreground">{e.rating}/10</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
