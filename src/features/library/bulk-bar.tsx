import { ask } from "@tauri-apps/plugin-dialog";
import { ListChecks, Minus, Monitor, Plus, Tags, Trash2, X } from "lucide-react";
import { useState } from "react";
import { COMMON_PLATFORMS } from "@/lib/constants";
import { useBulkCategory, useBulkDelete, useBulkUpdate, useCategories } from "@/lib/queries";
import { toast } from "@/lib/toast";
import { STATUSES, type LibraryEntry } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusTag, Tag } from "@/components/game/tags";

function plural(n: number) {
  return n === 1 ? "1 jogo" : `${n} jogos`;
}

/** Actions for the games selected in the table. */
export function BulkBar({
  selected,
  platforms,
  onClear,
}: {
  selected: LibraryEntry[];
  platforms: string[];
  onClear: () => void;
}) {
  const { data: categories = [] } = useCategories();
  const bulkUpdate = useBulkUpdate();
  const bulkCategory = useBulkCategory();
  const bulkDelete = useBulkDelete();
  const [platform, setPlatform] = useState("");
  const [platformOpen, setPlatformOpen] = useState(false);
  const ids = selected.map((e) => e.id);
  const busy = bulkUpdate.isPending || bulkCategory.isPending || bulkDelete.isPending;

  const remove = async () => {
    const ok = await ask(`Remover ${plural(selected.length)} da biblioteca?`, { title: "Remover jogos", kind: "warning" });
    if (!ok) return;
    await bulkDelete.mutateAsync(ids);
    toast.info(`${plural(selected.length)} ${selected.length === 1 ? "removido" : "removidos"}.`);
    onClear();
  };

  const savePlatform = async (e: React.FormEvent) => {
    e.preventDefault();
    await bulkUpdate.mutateAsync({ entries: selected, patch: { platform: platform.trim() } });
    setPlatformOpen(false);
    setPlatform("");
    toast.info(`Plataforma de ${plural(selected.length)} atualizada.`);
  };

  return (
    <div className="sticky top-2 z-30 mb-2 flex flex-wrap items-center gap-1 rounded-lg border border-border bg-popover px-2 py-1.5 shadow-lg">
      <span className="px-1 text-sm font-medium">
        {selected.length === 1 ? "1 selecionado" : `${selected.length} selecionados`}
      </span>
      <span className="mx-1 h-4 w-px bg-border" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="subtle" disabled={busy}>
            <ListChecks /> Status
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {STATUSES.map((s) => (
            <DropdownMenuItem
              key={s}
              onSelect={() =>
                bulkUpdate.mutate(
                  { entries: selected.filter((e) => e.status !== s), patch: { status: s } },
                  { onSuccess: () => toast.info(`Status de ${plural(selected.length)} atualizado.`) },
                )
              }
            >
              <StatusTag status={s} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {(["add", "remove"] as const).map((mode) => (
        <DropdownMenu key={mode}>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="subtle" disabled={busy || !categories.length}>
              {mode === "add" ? <Plus /> : <Minus />}
              <Tags /> {mode === "add" ? "Categoria" : "Tirar categoria"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-80 overflow-auto">
            <DropdownMenuLabel>{mode === "add" ? "Adicionar aos selecionados" : "Tirar dos selecionados"}</DropdownMenuLabel>
            {categories
              .filter((c) => mode === "add" || selected.some((e) => e.categoryIds.includes(c.id)))
              .map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  onSelect={() => bulkCategory.mutate({ entryIds: ids, categoryId: c.id, on: mode === "add" })}
                >
                  <Tag color={c.color}>{c.name}</Tag>
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ))}

      <Popover open={platformOpen} onOpenChange={setPlatformOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="subtle" disabled={busy}>
            <Monitor /> Plataforma
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2">
          <form onSubmit={savePlatform} className="flex gap-1.5">
            <Input
              autoFocus
              value={platform}
              list="bulk-platforms"
              onChange={(e) => setPlatform(e.target.value)}
              placeholder="Vazio limpa o campo"
              className="h-7"
            />
            <Button size="sm" variant="default" type="submit">
              Aplicar
            </Button>
          </form>
          <datalist id="bulk-platforms">
            {[...new Set([...platforms, ...COMMON_PLATFORMS])].map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </PopoverContent>
      </Popover>

      <Button size="sm" variant="destructive" onClick={remove} disabled={busy}>
        <Trash2 /> Remover
      </Button>

      <Button size="icon" variant="subtle" className="ml-auto" onClick={onClear} title="Limpar seleção">
        <X />
      </Button>
    </div>
  );
}
