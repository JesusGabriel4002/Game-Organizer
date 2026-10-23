import { ask } from "@tauri-apps/plugin-dialog";
import { AlertTriangle, CheckCircle2, Clock, MoreHorizontal, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCategories, useDeleteGoal, useGoals, useLibrary } from "@/lib/queries";
import type { Goal } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState, PageContainer, PageHeader } from "@/components/layout/page";
import { Cover } from "@/components/game/cover";
import { Tag } from "@/components/game/tags";
import { GoalDialog } from "./goal-dialog";
import { computeProgress, daysLeftLabel, formatDate, type GoalProgress, type GoalState } from "./progress";

const STATE_META: Record<GoalState, { label: string; icon: React.ReactNode; className: string }> = {
  done: { label: "Concluída", icon: <CheckCircle2 />, className: "text-[#4dab9a]" },
  late: { label: "Concluída com atraso", icon: <CheckCircle2 />, className: "text-[#dfab01]" },
  failed: { label: "Não concluída", icon: <XCircle />, className: "text-destructive" },
  behind: { label: "Atenção ao prazo", icon: <AlertTriangle />, className: "text-[#d9730d]" },
  active: { label: "Em andamento", icon: <Clock />, className: "text-muted-foreground" },
  orphan: { label: "Jogo removido", icon: <XCircle />, className: "text-muted-foreground" },
};

function GoalCard({ goal, progress, onEdit }: { goal: Goal; progress: GoalProgress; onEdit: () => void }) {
  const { data: categories = [] } = useCategories();
  const remove = useDeleteGoal();
  const meta = STATE_META[progress.state];
  const category = categories.find((c) => c.id === goal.categoryId);
  const finished = progress.state === "done" || progress.state === "late" || progress.state === "failed";

  const onDelete = async () => {
    if (await ask(`Excluir a meta "${goal.title}"?`, { title: "Excluir meta", kind: "warning" })) remove.mutate(goal.id);
  };

  return (
    <div className="group rounded-lg border border-border p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className={cn("mb-1 flex items-center gap-1.5 text-xs font-medium [&_svg]:size-3.5", meta.className)}>
            {meta.icon}
            {meta.label}
          </div>
          <h3 className="font-semibold leading-snug">{goal.title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {goal.periodStart && goal.type === "count_by_period" ? `${formatDate(goal.periodStart)} → ` : "Até "}
            {formatDate(goal.deadline)}
            {!finished && ` · ${daysLeftLabel(progress.daysLeft)}`}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="subtle" className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDelete} className="text-destructive">
              <Trash2 className="!text-destructive" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Progress
          value={progress.percent}
          tone={progress.state === "done" ? "success" : progress.state === "failed" ? "danger" : "primary"}
        />
        {goal.type === "count_by_period" && (
          <span className="shrink-0 text-sm font-medium tabular-nums">
            {progress.current}/{progress.target}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{progress.hint}</span>
        {category && <Tag color={category.color}>{category.name}</Tag>}
      </div>

      {progress.entries.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {progress.entries.slice(0, 12).map((e) => (
            <Link key={e.id} to={`/game/${e.id}`} title={e.name}>
              <Cover url={e.coverUrl} name={e.name} className="h-12 w-9 rounded-sm border border-border hover:opacity-80" />
            </Link>
          ))}
          {progress.entries.length > 12 && (
            <span className="self-center text-xs text-muted-foreground">+{progress.entries.length - 12}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function GoalsPage() {
  const { data: goals = [] } = useGoals();
  const { data: library = [] } = useLibrary();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | undefined>();

  const withProgress = useMemo(() => goals.map((g) => ({ goal: g, progress: computeProgress(g, library) })), [goals, library]);
  const active = withProgress.filter((g) => ["active", "behind"].includes(g.progress.state));
  const finished = withProgress.filter((g) => !["active", "behind"].includes(g.progress.state));

  const openNew = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };

  return (
    <PageContainer>
      <PageHeader
        icon="🎯"
        title="Metas"
        description="Zerar um jogo até uma data, zerar em um ano ou zerar uma quantidade de jogos num período."
        actions={
          <Button variant="default" onClick={openNew}>
            <Plus /> Nova meta
          </Button>
        }
      />

      {goals.length === 0 ? (
        <EmptyState title="Nenhuma meta ainda">
          Que tal “Zerar 12 jogos em {new Date().getFullYear()}”?{" "}
          <button className="text-primary underline" onClick={openNew}>
            Criar a primeira meta
          </button>
        </EmptyState>
      ) : (
        <>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Em andamento ({active.length})</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {active.map(({ goal, progress }) => (
              <GoalCard key={goal.id} goal={goal} progress={progress} onEdit={() => (setEditing(goal), setDialogOpen(true))} />
            ))}
          </div>
          {active.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma meta em andamento.</p>}

          {finished.length > 0 && (
            <>
              <h2 className="mb-2 mt-8 text-sm font-medium text-muted-foreground">Encerradas ({finished.length})</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {finished.map(({ goal, progress }) => (
                  <GoalCard key={goal.id} goal={goal} progress={progress} onEdit={() => (setEditing(goal), setDialogOpen(true))} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <GoalDialog open={dialogOpen} onOpenChange={setDialogOpen} goal={editing} />
    </PageContainer>
  );
}
