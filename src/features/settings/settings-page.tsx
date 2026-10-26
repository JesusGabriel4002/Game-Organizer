import { useQuery, useQueryClient } from "@tanstack/react-query";
import { appConfigDir } from "@tauri-apps/api/path";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { CheckCircle2, Download, Upload } from "lucide-react";
import { files, igdb } from "@/lib/api";
import { exportBackup, getSetting, importBackup, setSetting, type Backup } from "@/lib/db";
import { useUi, type Theme } from "@/lib/store";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { AccountSection } from "@/features/account/account-section";
import { CsvExportButton, CsvImportButton } from "./csv-import";

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
  const status = useQuery({ queryKey: ["igdb-status"], queryFn: igdb.status, staleTime: 0 });

  return (
    <Section
      title="Busca de jogos (IGDB)"
      description="O IGDB é a base de jogos da Twitch. A busca funciona pelo servidor do Game Organizer, sem configurar nada."
    >
      {status.data?.configured ? (
        <div className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm">
          <CheckCircle2 className="size-4 text-[#4dab9a]" />
          {status.data.source === "proxy" ? "Usando o servidor de busca padrão" : "Usando uma chave própria da Twitch"}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Servidor de busca indisponível no momento.</p>
      )}
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

      <Section
        title="Conta e sincronização"
        description="Opcional. Com uma conta, a biblioteca sobe para a nuvem quando houver internet e continua disponível neste aparelho offline."
      >
        <AccountSection />
      </Section>

      <IgdbSection />

      <Section
        title="Lista de jogos (CSV)"
        description="Exporte sua biblioteca ou importe de uma planilha (Excel, Google Sheets...). O formato é o mesmo nos dois sentidos."
      >
        <div className="flex flex-wrap items-center gap-2">
          <CsvExportButton />
          <CsvImportButton />
        </div>
      </Section>

      <BackupSection />

      <Section title="Dados locais" description="Seu banco SQLite e as chaves ficam nesta pasta (fora do repositório):">
        <code className="block rounded-md bg-accent px-3 py-2 text-xs">{dataDir.data ?? "..."}</code>
      </Section>
    </PageContainer>
  );
}
