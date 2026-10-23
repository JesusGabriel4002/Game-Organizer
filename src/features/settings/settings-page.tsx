import { useQuery, useQueryClient } from "@tanstack/react-query";
import { appConfigDir } from "@tauri-apps/api/path";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CheckCircle2, Download, ExternalLink, KeyRound, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { files, igdb } from "@/lib/api";
import { exportBackup, getSetting, importBackup, setSetting, type Backup } from "@/lib/db";
import { useUi, type Theme } from "@/lib/store";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { PageContainer, PageHeader } from "@/components/layout/page";

function Section({ title, description, children }: { title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-6">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function IgdbSection() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["igdb-status"], queryFn: igdb.status, staleTime: 0 });
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await igdb.saveCredentials(clientId, clientSecret);
      setClientId("");
      setClientSecret("");
      toast.info("Chaves validadas e salvas neste computador.");
      qc.invalidateQueries({ queryKey: ["igdb-status"] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    await igdb.clearCredentials();
    qc.invalidateQueries({ queryKey: ["igdb-status"] });
    toast.info("Chaves removidas.");
  };

  return (
    <Section
      title="Busca de jogos (IGDB)"
      description={
        <>
          O IGDB é a base de jogos da Twitch. Crie um app grátis em{" "}
          <button className="text-primary underline" onClick={() => openUrl("https://dev.twitch.tv/console/apps")}>
            dev.twitch.tv/console/apps <ExternalLink className="inline size-3" />
          </button>{" "}
          (OAuth Redirect URL: <code>http://localhost</code>, categoria "Application Integration") e cole o Client ID e
          o Client Secret aqui. Elas ficam salvas só neste PC, fora do repositório.
        </>
      }
    >
      {status.data?.configured && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm">
          <CheckCircle2 className="size-4 text-[#4dab9a]" />
          <span className="flex-1">
            Configurado ({status.data.source === "env" ? "variáveis de ambiente" : "salvo no app"}) · Client ID{" "}
            {status.data.clientIdHint}
          </span>
          {status.data.source === "settings" && (
            <Button size="sm" variant="destructive" onClick={clear}>
              Remover
            </Button>
          )}
        </div>
      )}
      <div className="grid max-w-md gap-3">
        <div className="grid gap-1">
          <Label htmlFor="client-id">Client ID</Label>
          <Input id="client-id" value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="client-secret">Client Secret</Label>
          <Input
            id="client-secret"
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <Button variant="default" onClick={save} disabled={saving || !clientId || !clientSecret}>
            {saving ? <Loader2 className="animate-spin" /> : <KeyRound />}
            Validar e salvar
          </Button>
        </div>
      </div>
    </Section>
  );
}

function BackupSection() {
  const qc = useQueryClient();
  const lastBackup = useQuery({ queryKey: ["setting", "lastBackupAt"], queryFn: () => getSetting("lastBackupAt") });

  const doExport = async () => {
    try {
      const date = new Date().toISOString().slice(0, 10);
      const path = await saveDialog({
        defaultPath: `game-organizer-backup-${date}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path) return;
      const backup = await exportBackup();
      await files.write(path, JSON.stringify(backup, null, 2));
      await setSetting("lastBackupAt", backup.exportedAt);
      qc.invalidateQueries({ queryKey: ["setting", "lastBackupAt"] });
      toast.info("Backup exportado.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const doImport = async () => {
    try {
      const path = await openDialog({ multiple: false, filters: [{ name: "JSON", extensions: ["json"] }] });
      if (!path || Array.isArray(path)) return;
      const backup = JSON.parse(await files.read(path)) as Backup;
      const { imported, skipped } = await importBackup(backup);
      await qc.invalidateQueries();
      toast.info(`Backup importado: ${imported} registros atualizados${skipped ? `, ${skipped} ignorados` : ""}.`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Section
      title="Backup"
      description="Exporta jogos, categorias e metas para um arquivo JSON. As chaves do IGDB nunca são incluídas. Ao importar, os registros são mesclados e a versão mais recente de cada um é mantida."
    >
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={doExport}>
          <Download /> Exportar backup
        </Button>
        <Button variant="outline" onClick={doImport}>
          <Upload /> Importar backup
        </Button>
        {lastBackup.data && (
          <span className="ml-2 text-sm text-muted-foreground">
            Último backup: {new Date(lastBackup.data).toLocaleString("pt-BR")}
          </span>
        )}
      </div>
    </Section>
  );
}

export function SettingsPage() {
  const { theme, setTheme } = useUi();
  const dataDir = useQuery({ queryKey: ["app-config-dir"], queryFn: appConfigDir });

  return (
    <PageContainer>
      <PageHeader icon="⚙️" title="Configurações" />

      <Section title="Aparência">
        <div className="grid max-w-xs gap-1">
          <Label htmlFor="theme">Tema</Label>
          <Select id="theme" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
            <option value="system">Igual ao sistema</option>
            <option value="light">Claro</option>
            <option value="dark">Escuro</option>
          </Select>
        </div>
      </Section>

      <IgdbSection />
      <BackupSection />

      <Section title="Dados locais" description="Seu banco SQLite e as chaves ficam nesta pasta (fora do repositório):">
        <code className="block rounded-md bg-accent px-3 py-2 text-xs">{dataDir.data ?? "..."}</code>
      </Section>
    </PageContainer>
  );
}
