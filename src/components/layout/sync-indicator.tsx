import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Cloud, CloudOff, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/queries";
import { isSupabaseConfigured } from "@/lib/supabase";
import { syncNow } from "@/lib/sync";
import { useSyncStatus } from "@/lib/use-cloud-sync";
import { cn } from "@/lib/utils";

function ago(iso: string | null) {
  if (!iso) return null;
  const diff = Date.now() - parseISO(iso).getTime();
  if (diff < 60_000) return "agora";
  return `há ${formatDistanceToNowStrict(parseISO(iso), { locale: ptBR })}`;
}

/** Sidebar line with the cloud sync state; click to sync now. */
export function SyncIndicator() {
  const sync = useSyncStatus();
  const qc = useQueryClient();
  // Re-render every 30 s so "há 2 minutos" stays current.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!isSupabaseConfigured() || sync.status === "disabled") return null;

  const last = ago(sync.lastSyncAt);
  const pending = sync.pending > 0 ? `${sync.pending} ${sync.pending === 1 ? "mudança pendente" : "mudanças pendentes"}` : null;

  let icon = <Cloud className={pending ? "" : "text-[#4dab9a]"} />;
  let label = pending ?? (last ? `Sincronizado ${last}` : "Sincronizado");
  if (sync.status === "offline") {
    icon = <CloudOff />;
    label = pending ? `Offline · ${pending}` : "Offline";
  } else if (sync.status === "syncing") {
    icon = <Loader2 className="animate-spin" />;
    label = "Sincronizando…";
  } else if (sync.status === "error") {
    icon = <AlertTriangle className="text-destructive" />;
    label = "Erro na sincronização";
  }

  const details = [
    sync.error,
    last ? `Última sincronização: ${new Date(sync.lastSyncAt!).toLocaleString("pt-BR")}` : "Ainda não sincronizou",
    pending,
    "Clique para sincronizar agora.",
  ]
    .filter(Boolean)
    .join("\n");

  const run = async () => {
    try {
      const { pulled } = await syncNow({ force: true });
      if (pulled > 0) {
        await Promise.all([keys.library, keys.categories, keys.goals, keys.sessions].map((k) => qc.invalidateQueries({ queryKey: k })));
      }
    } catch {
      // The error shows up in the indicator.
    }
  };

  return (
    <button
      onClick={() => void run()}
      disabled={sync.status === "syncing" || sync.status === "offline"}
      title={details}
      className={cn(
        "group mb-1 flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-xs text-muted-foreground hover:bg-accent disabled:hover:bg-transparent [&_svg]:size-3.5 [&_svg]:shrink-0",
        sync.status === "error" && "text-destructive",
      )}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {sync.status !== "syncing" && sync.status !== "offline" && (
        <RefreshCw className="opacity-0 group-hover:opacity-100" />
      )}
    </button>
  );
}
