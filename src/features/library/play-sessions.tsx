import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useAddSession, useDeleteSession, useSessions } from "@/lib/queries";
import { toast } from "@/lib/toast";
import type { LibraryEntry } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (!h) return `${m} min`;
  return m ? `${h}h ${m}min` : `${h}h`;
}

function today() {
  return format(new Date(), "yyyy-MM-dd");
}

/** "1:30", "1h30", "1,5" (hours) or "90min" → minutes. */
export function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase().replace(",", ".");
  if (!t) return null;
  const clock = t.match(/^(\d+):(\d{1,2})$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const hm = t.match(/^(\d+(?:\.\d+)?)\s*h\s*(?:(\d+)\s*(?:m|min)?)?$/);
  if (hm) return Math.round(Number(hm[1]) * 60 + Number(hm[2] ?? 0));
  const min = t.match(/^(\d+)\s*(?:m|min)$/);
  if (min) return Number(min[1]);
  const hours = Number(t);
  return Number.isFinite(hours) ? Math.round(hours * 60) : null;
}

export function PlaySessions({ entry }: { entry: LibraryEntry }) {
  const { data: all = [] } = useSessions();
  const addSession = useAddSession();
  const deleteSession = useDeleteSession();
  const [playedOn, setPlayedOn] = useState(today);
  const [duration, setDuration] = useState("");
  const [note, setNote] = useState("");

  const sessions = useMemo(() => all.filter((s) => s.userGameId === entry.id), [all, entry.id]);
  const total = sessions.reduce((sum, s) => sum + s.minutes, 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const minutes = parseDuration(duration);
    if (!minutes || minutes <= 0) {
      toast.error("Informe a duração, por exemplo 1:30, 2h ou 45min.");
      return;
    }
    await addSession.mutateAsync({ entry, playedOn: playedOn || today(), minutes, note });
    if (entry.status === "backlog" || entry.status === "wishlist") toast.info(`${entry.name} agora está em "Jogando".`);
    setDuration("");
    setNote("");
  };

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Sessões de jogo</h2>
        {sessions.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {sessions.length} {sessions.length === 1 ? "sessão" : "sessões"} · {formatMinutes(total)}
          </span>
        )}
      </div>

      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <Input
          type="date"
          value={playedOn}
          onChange={(e) => setPlayedOn(e.target.value)}
          className="w-36 [color-scheme:light] dark:[color-scheme:dark]"
          aria-label="Data"
        />
        <Input
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="Duração (1:30)"
          className="w-32"
          aria-label="Duração"
        />
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anotação (opcional)" className="min-w-40 flex-1" />
        <Button type="submit" variant="outline" disabled={addSession.isPending}>
          <Plus /> Registrar
        </Button>
      </form>
      <p className="mt-1 text-xs text-muted-foreground">O tempo de cada sessão é somado às horas jogadas.</p>

      {sessions.length > 0 && (
        <ul className="mt-3 divide-y divide-border rounded-md border border-border">
          {sessions.map((s) => (
            <li key={s.id} className="group flex items-center gap-3 px-3 py-1.5 text-sm">
              <span className="w-28 shrink-0 text-muted-foreground">
                {format(parseISO(s.playedOn), "d 'de' MMM yyyy", { locale: ptBR })}
              </span>
              <span className="w-20 shrink-0 tabular-nums">{formatMinutes(s.minutes)}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.note}</span>
              <button
                onClick={() => deleteSession.mutate(s)}
                title="Apagar sessão (desconta das horas)"
                className="rounded p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
