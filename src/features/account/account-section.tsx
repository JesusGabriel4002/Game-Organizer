import { useEffect, useState } from "react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { Cloud, CloudOff, Loader2, LogOut, RefreshCw, Trash2 } from "lucide-react";
import {
  clearLocalLibrary,
  deleteCloudAccount,
  initAuth,
  mergeWithCloudLibrary,
  replaceWithCloudLibrary,
  signOut,
  writeAutoBackup,
  type AuthUser,
} from "@/lib/account";
import { keys } from "@/lib/queries";
import { isSupabaseConfigured } from "@/lib/supabase";
import { syncNow } from "@/lib/sync";
import { useSyncStatus } from "@/lib/use-cloud-sync";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { AuthDialog } from "./auth-dialog";

function statusLabel(status: string, pending: number, lastSyncAt: string | null) {
  if (status === "disabled") return "Sincronização não configurada neste build.";
  if (status === "offline") return "Sem internet — mudanças ficam no aparelho.";
  if (status === "syncing") return "Sincronizando…";
  if (status === "error") return "Falha na última sincronização.";
  if (pending > 0) return `${pending} alteração${pending === 1 ? "" : "ões"} aguardando envio.`;
  if (lastSyncAt) return `Última sincronização: ${new Date(lastSyncAt).toLocaleString("pt-BR")}`;
  return "Pronto para sincronizar.";
}

export function AccountSection() {
  const qc = useQueryClient();
  const sync = useSyncStatus();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [choiceUser, setChoiceUser] = useState<AuthUser | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    void initAuth().then(setUser).catch(() => setUser(null));
  }, []);

  const invalidate = () => Promise.all([keys.library, keys.categories, keys.goals].map((k) => qc.invalidateQueries({ queryKey: k })));

  if (!isSupabaseConfigured()) {
    return (
      <div className="rounded-md bg-accent px-3 py-2 text-sm text-muted-foreground">
        A sincronização na nuvem não está disponível neste build. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
      </div>
    );
  }

  const onSignedIn = (u: AuthUser) => {
    setUser(u);
    void invalidate();
  };

  const doSignOut = async (wipeLocal: boolean) => {
    setBusy(true);
    try {
      await signOut();
      if (wipeLocal) {
        await clearLocalLibrary();
        await invalidate();
      }
      setUser(null);
      toast.info(wipeLocal ? "Saiu e apagou os dados deste aparelho." : "Saiu da conta. Os dados locais foram mantidos.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const resolveChoice = async (mode: "merge" | "replace") => {
    if (!choiceUser) return;
    setBusy(true);
    try {
      if (mode === "replace") {
        const path = await saveDialog({
          defaultPath: `game-organizer-backup-antes-troca-${new Date().toISOString().slice(0, 10)}.json`,
          filters: [{ name: "JSON", extensions: ["json"] }],
        });
        if (path) await writeAutoBackup(path);
        await replaceWithCloudLibrary();
        toast.info("Biblioteca substituída pelos dados da conta.");
      } else {
        await mergeWithCloudLibrary(choiceUser.id);
        toast.info("Biblioteca mesclada com a conta.");
      }
      setUser(choiceUser);
      setChoiceUser(null);
      await invalidate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {!user ? (
        <>
          <p className="text-sm text-muted-foreground">
            Opcional. Sem conta o app funciona só neste computador. Com conta, a biblioteca sincroniza quando houver internet.
          </p>
          <Button variant="default" onClick={() => setAuthOpen(true)}>
            Entrar ou criar conta
          </Button>
        </>
      ) : (
        <>
          <div className="flex items-start gap-3 rounded-md border border-border px-3 py-2">
            {sync.status === "offline" ? (
              <CloudOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            ) : sync.status === "syncing" ? (
              <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Cloud className="mt-0.5 size-4 shrink-0 text-[#4dab9a]" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.email}</p>
              <p className="text-xs text-muted-foreground">{statusLabel(sync.status, sync.pending, sync.lastSyncAt)}</p>
              {sync.error && <p className="mt-1 text-xs text-destructive">{sync.error}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={busy || sync.status === "syncing"}
              onClick={() =>
                void syncNow({ force: true })
                  .then(() => invalidate())
                  .then(() => toast.info("Sincronização concluída."))
                  .catch((err) => toast.error(errorMessage(err)))
              }
            >
              <RefreshCw /> Sincronizar agora
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void doSignOut(false)}>
              <LogOut /> Sair
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void doSignOut(true)}>
              <LogOut /> Sair e apagar dados locais
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setDeleteOpen(true)}>
              <Trash2 /> Excluir conta
            </Button>
          </div>
        </>
      )}

      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        onSignedIn={onSignedIn}
        onNeedsAccountChoice={setChoiceUser}
      />

      <Dialog open={!!choiceUser} onOpenChange={(o) => !o && setChoiceUser(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle>Troca de conta</DialogTitle>
          <DialogDescription className="mt-1">
            Este aparelho já sincronizou com outra conta. Quer mesclar os dados locais com{" "}
            <strong>{choiceUser?.email}</strong> ou substituir pelos dados da nuvem?
          </DialogDescription>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => void resolveChoice("merge")}>
              Mesclar
            </Button>
            <Button variant="default" disabled={busy} onClick={() => void resolveChoice("replace")}>
              Substituir (com backup)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Excluir conta</DialogTitle>
          <DialogDescription className="mt-1">
            Apaga permanentemente sua conta e todos os dados na nuvem. Digite a senha para confirmar.
          </DialogDescription>
          <div className="mt-3 grid gap-1">
            <Label htmlFor="delete-password">Senha</Label>
            <Input
              id="delete-password"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="default"
              disabled={busy || !deletePassword}
              onClick={() =>
                void (async () => {
                  setBusy(true);
                  try {
                    await deleteCloudAccount(deletePassword);
                    setUser(null);
                    setDeleteOpen(false);
                    setDeletePassword("");
                    await invalidate();
                    toast.info("Conta excluída.");
                  } catch (err) {
                    toast.error(errorMessage(err));
                  } finally {
                    setBusy(false);
                  }
                })()
              }
            >
              Excluir definitivamente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
