import { CalendarDays, CalendarRange, Hash } from "lucide-react";
import { useEffect, useState } from "react";
import { useCategories, useLibrary, useSaveGoal } from "@/lib/queries";
import type { Goal, GoalInput, GoalType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";

const TYPES: { type: GoalType; label: string; description: string; icon: React.ReactNode }[] = [
  { type: "game_by_date", label: "Jogo até uma data", description: "Zerar X até 15/03/2026", icon: <CalendarDays /> },
  { type: "game_by_year", label: "Jogo em um ano", description: "Zerar X em 2026", icon: <CalendarRange /> },
  { type: "count_by_period", label: "Quantidade", description: "Zerar 12 jogos em 2026", icon: <Hash /> },
];

const thisYear = new Date().getFullYear();

interface FormState {
  type: GoalType;
  title: string;
  userGameId: string;
  deadline: string;
  year: number;
  targetCount: number;
  categoryId: string;
  customPeriod: boolean;
  periodStart: string;
}

function initialState(goal?: Goal): FormState {
  const year = goal ? Number(goal.deadline.slice(0, 4)) : thisYear;
  const isFullYear = !goal || (goal.periodStart === `${year}-01-01` && goal.deadline === `${year}-12-31`);
  return {
    type: goal?.type ?? "game_by_date",
    title: goal?.title ?? "",
    userGameId: goal?.userGameId ?? "",
    deadline: goal?.deadline ?? "",
    year,
    targetCount: goal?.targetCount ?? 12,
    categoryId: goal?.categoryId ?? "",
    customPeriod: goal?.type === "count_by_period" && !isFullYear,
    periodStart: goal?.periodStart ?? new Date().toISOString().slice(0, 10),
  };
}

export function GoalDialog({ open, onOpenChange, goal }: { open: boolean; onOpenChange: (open: boolean) => void; goal?: Goal }) {
  const { data: library = [] } = useLibrary();
  const { data: categories = [] } = useCategories();
  const save = useSaveGoal();
  const [form, setForm] = useState<FormState>(() => initialState(goal));

  useEffect(() => {
    if (open) setForm(initialState(goal));
  }, [open, goal]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const games = [...library].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const game = library.find((e) => e.id === form.userGameId);
  const category = categories.find((c) => c.id === form.categoryId);

  const build = (): GoalInput | null => {
    if (form.type === "game_by_date") {
      if (!game || !form.deadline) return null;
      return {
        type: form.type,
        title: form.title || `Zerar ${game.name}`,
        userGameId: game.id,
        categoryId: null,
        targetCount: null,
        periodStart: null,
        deadline: form.deadline,
      };
    }
    if (form.type === "game_by_year") {
      if (!game || !form.year) return null;
      return {
        type: form.type,
        title: form.title || `Zerar ${game.name} em ${form.year}`,
        userGameId: game.id,
        categoryId: null,
        targetCount: null,
        periodStart: `${form.year}-01-01`,
        deadline: `${form.year}-12-31`,
      };
    }
    if (form.targetCount < 1) return null;
    const periodStart = form.customPeriod ? form.periodStart : `${form.year}-01-01`;
    const deadline = form.customPeriod ? form.deadline : `${form.year}-12-31`;
    if (!periodStart || !deadline || deadline < periodStart) return null;
    const what = category ? `jogos ${category.name}` : "jogos";
    return {
      type: form.type,
      title: form.title || `Zerar ${form.targetCount} ${what}${form.customPeriod ? "" : ` em ${form.year}`}`,
      userGameId: null,
      categoryId: category?.id ?? null,
      targetCount: form.targetCount,
      periodStart,
      deadline,
    };
  };

  const input = build();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input) return;
    await save.mutateAsync({ input, id: goal?.id });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogTitle>{goal ? "Editar meta" : "Nova meta"}</DialogTitle>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => (
              <button
                type="button"
                key={t.type}
                onClick={() => set("type", t.type)}
                className={cn(
                  "rounded-md border border-border p-2.5 text-left transition-colors hover:bg-accent [&_svg]:mb-1 [&_svg]:size-4",
                  form.type === t.type && "border-primary bg-primary/5",
                )}
              >
                {t.icon}
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-xs text-muted-foreground">{t.description}</div>
              </button>
            ))}
          </div>

          {form.type !== "count_by_period" && (
            <div className="grid gap-1">
              <Label htmlFor="goal-game">Jogo</Label>
              <Select id="goal-game" value={form.userGameId} onChange={(e) => set("userGameId", e.target.value)}>
                <option value="">Escolha um jogo da biblioteca…</option>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                    {g.status === "completed" ? " (zerado)" : ""}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {form.type === "game_by_date" && (
            <div className="grid gap-1">
              <Label htmlFor="goal-deadline">Zerar até</Label>
              <Input id="goal-deadline" type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} className="max-w-48" />
            </div>
          )}

          {form.type === "count_by_period" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label htmlFor="goal-count">Quantidade de jogos</Label>
                <Input
                  id="goal-count"
                  type="number"
                  min={1}
                  value={form.targetCount}
                  onChange={(e) => set("targetCount", Number(e.target.value))}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="goal-category">Categoria (opcional)</Label>
                <Select id="goal-category" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                  <option value="">Qualquer jogo</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}

          {(form.type === "game_by_year" || (form.type === "count_by_period" && !form.customPeriod)) && (
            <div className="grid gap-1">
              <Label htmlFor="goal-year">Ano</Label>
              <Input
                id="goal-year"
                type="number"
                min={2000}
                max={2100}
                value={form.year}
                onChange={(e) => set("year", Number(e.target.value))}
                className="max-w-32"
              />
            </div>
          )}

          {form.type === "count_by_period" && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.customPeriod} onChange={(e) => set("customPeriod", e.target.checked)} />
                Usar um período personalizado em vez do ano inteiro
              </label>
              {form.customPeriod && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <Label htmlFor="goal-start">De</Label>
                    <Input id="goal-start" type="date" value={form.periodStart} onChange={(e) => set("periodStart", e.target.value)} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="goal-end">Até</Label>
                    <Input id="goal-end" type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="grid gap-1">
            <Label htmlFor="goal-title">Título (opcional)</Label>
            <Input
              id="goal-title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder={input?.title ?? "Gerado automaticamente"}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="default" disabled={!input || save.isPending}>
              {goal ? "Salvar" : "Criar meta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
