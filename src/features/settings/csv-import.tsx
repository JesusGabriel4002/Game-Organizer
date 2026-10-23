import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { FileSpreadsheet, FileDown } from "lucide-react";
import { files } from "@/lib/api";
import { CSV_TEMPLATE, importCsvRows, parseCsv, type ImportResult } from "@/lib/csv-import";
import { keys } from "@/lib/queries";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

const COLUMNS: { name: string; description: string }[] = [
  { name: "nome", description: "Obrigatório. O nome do jogo, buscado no IGDB para trazer capa, gênero e notas." },
  { name: "status", description: "pra zerar, jogando ou zerado. Vazio vira “Pra zerar”." },
  { name: "ano", description: "Se zerado: o ano em que zerou. Se pra zerar: até quando quer zerar." },
  { name: "plataforma", description: "PC, PS5, Switch..." },
  { name: "nota", description: "De 0 a 10." },
  { name: "horas", description: "Horas jogadas." },
];

type Phase = { kind: "idle" } | { kind: "running"; done: number; total: number } | { kind: "done"; results: ImportResult[] };

function Summary({ results }: { results: ImportResult[] }) {
  const count = (o: ImportResult["outcome"]) => results.filter((r) => r.outcome === o).length;
  const approximate = results.filter((r) => r.matchedName);
  const manual = results.filter((r) => r.outcome === "manual");
  const failed = results.filter((r) => r.outcome === "failed");
  return (
    <div className="space-y-3 text-sm">
      <ul className="space-y-0.5">
        <li>{count("added")} adicionados com dados do IGDB</li>
        {count("manual") > 0 && <li>{count("manual")} adicionados sem capa (não encontrados no IGDB)</li>}
        {count("existing") > 0 && <li>{count("existing")} já estavam na biblioteca</li>}
        {failed.length > 0 && <li className="text-destructive">{failed.length} com erro</li>}
      </ul>
      {approximate.length > 0 && (
        <details>
          <summary className="cursor-pointer text-muted-foreground">Confira os nomes aproximados ({approximate.length})</summary>
          <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto pl-4 text-muted-foreground">
            {approximate.map((r) => (
              <li key={r.row.name}>
                {r.row.name} → <span className="text-foreground">{r.matchedName}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {manual.length > 0 && (
        <details>
          <summary className="cursor-pointer text-muted-foreground">Não encontrados ({manual.length})</summary>
          <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto pl-4 text-muted-foreground">
            {manual.map((r) => (
              <li key={r.row.name}>{r.row.name}</li>
            ))}
          </ul>
        </details>
      )}
      {failed.length > 0 && (
        <details open>
          <summary className="cursor-pointer text-destructive">Erros ({failed.length})</summary>
          <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto pl-4 text-muted-foreground">
            {failed.map((r) => (
              <li key={r.row.name}>
                {r.row.name}: {r.error}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function CsvImportButton() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const abort = useRef<AbortController | null>(null);

  const downloadTemplate = async () => {
    try {
      const path = await saveDialog({ defaultPath: "modelo-game-organizer.csv", filters: [{ name: "CSV", extensions: ["csv"] }] });
      if (path) await files.write(path, `\uFEFF${CSV_TEMPLATE}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const run = async () => {
    try {
      const path = await openDialog({ multiple: false, filters: [{ name: "CSV", extensions: ["csv", "txt"] }] });
      if (!path || Array.isArray(path)) return;
      const rows = parseCsv(await files.read(path));
      if (!rows.length) {
        toast.error("Nenhum jogo encontrado no arquivo.");
        return;
      }
      abort.current = new AbortController();
      setPhase({ kind: "running", done: 0, total: rows.length });
      const results = await importCsvRows(
        rows,
        (done) => setPhase({ kind: "running", done, total: rows.length }),
        abort.current.signal,
      );
      setPhase({ kind: "done", results });
    } catch (err) {
      toast.error(errorMessage(err));
      setPhase({ kind: "idle" });
    } finally {
      abort.current = null;
      await qc.invalidateQueries({ queryKey: keys.library });
    }
  };

  const onOpenChange = (next: boolean) => {
    if (phase.kind === "running") return;
    setOpen(next);
    if (!next) setPhase({ kind: "idle" });
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileSpreadsheet /> Importar CSV
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl" hideClose={phase.kind === "running"}>
          <DialogTitle>Importar jogos de um CSV</DialogTitle>

          {phase.kind === "idle" && (
            <>
              <DialogDescription className="mt-1">
                Só o nome é obrigatório: uma lista com um jogo por linha já funciona, e o resto você preenche depois no app. Se
                quiser, inclua as outras colunas para importar tudo de uma vez.
              </DialogDescription>
              <table className="mt-4 w-full text-sm">
                <tbody>
                  {COLUMNS.map((c) => (
                    <tr key={c.name} className="border-t border-border align-top">
                      <td className="py-1.5 pr-3 font-mono text-xs font-medium">{c.name}</td>
                      <td className="py-1.5 text-muted-foreground">{c.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-muted-foreground">Exemplo (separado por ponto e vírgula ou vírgula, com a primeira linha de títulos):</p>
              <pre className="mt-1 overflow-x-auto rounded-md bg-accent px-3 py-2 text-xs">{CSV_TEMPLATE}</pre>
              <p className="mt-3 text-xs text-muted-foreground">
                Os jogos são buscados um por vez, cerca de 2 por segundo, para respeitar o limite do IGDB. Jogos que já estão na
                biblioteca são pulados.
              </p>
              <div className="mt-4 flex justify-between gap-2">
                <Button variant="ghost" onClick={downloadTemplate}>
                  <FileDown /> Baixar modelo
                </Button>
                <Button variant="default" onClick={run}>
                  <FileSpreadsheet /> Escolher arquivo
                </Button>
              </div>
            </>
          )}

          {phase.kind === "running" && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Buscando {phase.done} de {phase.total}...
              </p>
              <Progress value={(phase.done / phase.total) * 100} />
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => abort.current?.abort()}>
                  Parar
                </Button>
              </div>
            </div>
          )}

          {phase.kind === "done" && (
            <div className="mt-4">
              <Summary results={phase.results} />
              <div className="mt-4 flex justify-end">
                <Button variant="default" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
