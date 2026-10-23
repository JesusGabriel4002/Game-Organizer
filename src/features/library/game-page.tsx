import { ask } from "@tauri-apps/plugin-dialog";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  Clock,
  Hash,
  Image,
  ListChecks,
  Monitor,
  MoreHorizontal,
  Shapes,
  Star,
  Tags,
  Target,
  Timer,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { COMMON_PLATFORMS } from "@/lib/constants";
import { useDeleteEntry, useEntry, useGoals, useSetEntryCategories, useUpdateEntry } from "@/lib/queries";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState, PageContainer } from "@/components/layout/page";
import { Cover } from "@/components/game/cover";
import { formatTimeToBeat } from "@/lib/igdb-info";
import { CompletionField } from "@/components/game/completion-field";
import { ScoreBadge } from "@/components/game/score-badge";
import { DateField, NumberField, RatingField, TextField } from "@/components/game/fields";
import { CategoryPicker, StatusSelect, Tag } from "@/components/game/tags";
import { NotesEditor } from "./notes-editor";

function Property({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-8 items-center gap-2">
      <div className="flex w-36 shrink-0 items-center gap-2 text-sm text-muted-foreground [&_svg]:size-4">
        {icon}
        {label}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function GamePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: entry, isLoading } = useEntry(id);
  const { data: goals = [] } = useGoals();
  const { mutate: updateEntry } = useUpdateEntry();
  const { mutate: setCategories } = useSetEntryCategories();
  const deleteEntry = useDeleteEntry();
  const [coverOpen, setCoverOpen] = useState(false);
  const [coverDraft, setCoverDraft] = useState("");

  if (isLoading) return null;
  if (!entry) {
    return (
      <PageContainer>
        <EmptyState title="Jogo não encontrado">
          <Link to="/" className="text-primary underline">
            Voltar para a biblioteca
          </Link>
        </EmptyState>
      </PageContainer>
    );
  }

  const linkedGoals = goals.filter((g) => g.userGameId === entry.id);

  const remove = async () => {
    const ok = await ask(`Remover "${entry.name}" da biblioteca?`, { title: "Remover jogo", kind: "warning" });
    if (!ok) return;
    await deleteEntry.mutateAsync(entry.id);
    toast.info(`${entry.name} removido.`);
    navigate("/");
  };

  return (
    <div>
      <div className="relative h-44 overflow-hidden bg-accent">
        {entry.coverUrl && (
          <img src={entry.coverUrl} alt="" className="size-full scale-110 object-cover opacity-60 blur-2xl" />
        )}
        <div className="absolute left-4 top-3 flex gap-1">
          <Button size="sm" variant="subtle" className="bg-background/70 backdrop-blur" onClick={() => navigate(-1)}>
            <ArrowLeft /> Voltar
          </Button>
        </div>
        <div className="absolute right-4 top-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="subtle" className="bg-background/70 backdrop-blur">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setCoverDraft(entry.coverUrl ?? "");
                  setCoverOpen(true);
                }}
              >
                <Image /> Alterar capa
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={remove} className="text-destructive">
                <Trash2 className="!text-destructive" /> Remover da biblioteca
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={coverOpen} onOpenChange={setCoverOpen}>
        <DialogContent>
          <DialogTitle>Alterar capa</DialogTitle>
          <DialogDescription className="mt-1">
            Cole a URL de uma imagem (https). Deixe vazio para remover.
          </DialogDescription>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              updateEntry({ entry, patch: { coverUrl: coverDraft.trim() } });
              setCoverOpen(false);
            }}
          >
            <Input autoFocus value={coverDraft} onChange={(e) => setCoverDraft(e.target.value)} placeholder="https://..." />
            <Button type="submit" variant="default">
              Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <PageContainer className="pt-0">
        <div className="-mt-24 flex items-end gap-6">
          <div className="relative shrink-0">
            <Cover url={entry.coverUrl} name={entry.name} className="h-56 w-40 rounded-lg border border-border shadow-xl" />
            <ScoreBadge entry={entry} />
          </div>
          <div className="min-w-0 pb-2">
            <TextField
              value={entry.name}
              onCommit={(name) => name && updateEntry({ entry, patch: { name } })}
              className="h-auto py-1 text-3xl font-bold tracking-tight"
            />
            {entry.genres.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1 px-1">
                {entry.genres.map((g) => (
                  <Tag key={g} color={g === "Indie" ? "purple" : "gray"}>
                    {g}
                  </Tag>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-0.5">
          <Property icon={<ListChecks />} label="Status">
            <StatusSelect value={entry.status} onChange={(status) => updateEntry({ entry, patch: { status } })} />
          </Property>
          <Property icon={<Tags />} label="Categorias">
            <CategoryPicker
              value={entry.categoryIds}
              onChange={(categoryIds) => setCategories({ entryId: entry.id, categoryIds })}
            />
          </Property>
          <Property icon={<Monitor />} label="Plataforma">
            <TextField
              value={entry.platform}
              list="game-platforms"
              onCommit={(platform) => updateEntry({ entry, patch: { platform } })}
            />
            <datalist id="game-platforms">
              {[...new Set([...entry.gamePlatforms, ...COMMON_PLATFORMS])].map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Property>
          <Property icon={<Star />} label="Nota">
            <div className="px-1">
              <RatingField value={entry.rating} onCommit={(rating) => updateEntry({ entry, patch: { rating } })} />
            </div>
          </Property>
          <Property icon={<Clock />} label="Horas jogadas">
            <NumberField value={entry.hours} suffix="h" onCommit={(hours) => updateEntry({ entry, patch: { hours } })} className="max-w-40" />
          </Property>
          {entry.timeToBeat !== null && (
            <Property icon={<Timer />} label="Tempo para zerar">
              <span className="px-1 text-sm">{formatTimeToBeat(entry.timeToBeat)}</span>
            </Property>
          )}
          <Property icon={<CalendarClock />} label="Começou em">
            <DateField value={entry.startedAt} onCommit={(startedAt) => updateEntry({ entry, patch: { startedAt } })} className="max-w-44" />
          </Property>
          <Property icon={<CalendarCheck />} label="Zerado em">
            <CompletionField entry={entry} detailed onPatch={(patch) => updateEntry({ entry, patch })} className="max-w-44" />
          </Property>
          {entry.releaseYear && (
            <Property icon={<Hash />} label="Lançamento">
              <span className="px-1 text-sm">{entry.releaseYear}</span>
            </Property>
          )}
          {entry.gamePlatforms.length > 0 && (
            <Property icon={<Shapes />} label="Disponível em">
              <span className="px-1 text-sm text-muted-foreground">{entry.gamePlatforms.join(", ")}</span>
            </Property>
          )}
          {linkedGoals.length > 0 && (
            <Property icon={<Target />} label="Metas">
              <div className="flex flex-wrap gap-1 px-1">
                {linkedGoals.map((g) => (
                  <Link key={g.id} to="/goals">
                    <Tag color="yellow">{g.title}</Tag>
                  </Link>
                ))}
              </div>
            </Property>
          )}
        </div>

        {entry.summary && (
          <p className="mt-6 rounded-md bg-accent px-4 py-3 text-sm leading-relaxed text-muted-foreground">{entry.summary}</p>
        )}

        <div className="mt-6 border-t border-border pt-6">
          <NotesEditor key={entry.id} value={entry.notes} onSave={(notes) => updateEntry({ entry, patch: { notes } })} />
        </div>
      </PageContainer>
    </div>
  );
}
