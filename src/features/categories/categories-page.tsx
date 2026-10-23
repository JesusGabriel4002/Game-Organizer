import { ask } from "@tauri-apps/plugin-dialog";
import { Check, ChevronRight, Palette, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { TAG_COLORS, TAG_COLOR_KEYS, randomTagColor } from "@/lib/constants";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useLibrary,
  useSetEntryCategories,
  useUpdateCategory,
} from "@/lib/queries";
import { toast } from "@/lib/toast";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState, PageContainer, PageHeader } from "@/components/layout/page";
import { TextField } from "@/components/game/fields";

const SUGGESTIONS = ["Indies", "AAA", "Soulslike", "Metroidvania", "Co-op", "Roguelike", "RPG", "Favoritos"];

function CategoryRow({ category, count }: { category: Category; count: number }) {
  const update = useUpdateCategory();
  const remove = useDeleteCategory();

  const onDelete = async () => {
    const ok = await ask(`Excluir a categoria "${category.name}"? Os jogos não serão removidos.`, {
      title: "Excluir categoria",
      kind: "warning",
    });
    if (ok) remove.mutate(category.id);
  };

  return (
    <div className="group flex items-center gap-2 border-b border-border py-1">
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-md p-1.5 hover:bg-accent" title="Cor">
          <span className={cn("block size-3 rounded-full", TAG_COLORS[category.color].dot)} />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {TAG_COLOR_KEYS.map((c) => (
            <DropdownMenuItem key={c} onSelect={() => update.mutate({ id: category.id, color: c })}>
              <span className={cn("size-3 rounded-full", TAG_COLORS[c].dot)} />
              {TAG_COLORS[c].label}
              {category.color === c && <Check className="ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <TextField
        value={category.name}
        onCommit={(name) => name && update.mutate({ id: category.id, name })}
        className="max-w-sm font-medium"
      />
      <span className="ml-auto text-sm text-muted-foreground">
        {count} {count === 1 ? "jogo" : "jogos"}
      </span>
      <Button size="icon" variant="destructive" className="opacity-0 group-hover:opacity-100" onClick={onDelete} title="Excluir">
        <Trash2 />
      </Button>
      <Link to={`/category/${category.id}`} className="rounded-md p-1 text-muted-foreground hover:bg-accent" title="Ver jogos">
        <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}

/** Creates (or reuses) a category per IGDB genre/theme and tags every game with its genres. */
function useAutoCategorize() {
  const { data: library = [] } = useLibrary();
  const { data: categories = [] } = useCategories();
  const create = useCreateCategory();
  const setEntryCategories = useSetEntryCategories();

  return async (genre: string, categoryName: string) => {
    const matching = library.filter((e) => e.genres.includes(genre));
    if (!matching.length) return toast.info(`Nenhum jogo com o gênero "${genre}" no IGDB.`);
    const category = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
    const id = category?.id ?? (await create.mutateAsync({ name: categoryName, color: randomTagColor() }));
    for (const e of matching) {
      if (!e.categoryIds.includes(id)) {
        await setEntryCategories.mutateAsync({ entryId: e.id, categoryIds: [...e.categoryIds, id] });
      }
    }
    toast.info(`${matching.length} jogos marcados como "${categoryName}".`);
  };
}

export function CategoriesPage() {
  const { data: categories = [] } = useCategories();
  const { data: library = [] } = useLibrary();
  const create = useCreateCategory();
  const autoCategorize = useAutoCategorize();
  const [name, setName] = useState("");

  const genres = [...new Set(library.flatMap((e) => e.genres))].sort();
  const unusedSuggestions = SUGGESTIONS.filter((s) => !categories.some((c) => c.name.toLowerCase() === s.toLowerCase()));

  const add = async (value = name) => {
    if (!value.trim()) return;
    await create.mutateAsync({ name: value, color: randomTagColor() });
    setName("");
  };

  return (
    <PageContainer>
      <PageHeader icon="🏷️" title="Categorias" description="Agrupe seus jogos do seu jeito: indies, favoritos, co-op, o que quiser." />

      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova categoria..." className="max-w-sm" />
        <Button type="submit" variant="default" disabled={!name.trim()}>
          <Plus /> Criar
        </Button>
      </form>

      {unusedSuggestions.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          Sugestões:
          {unusedSuggestions.map((s) => (
            <button key={s} onClick={() => add(s)} className="rounded-md border border-dashed border-border px-2 py-0.5 hover:bg-accent">
              + {s}
            </button>
          ))}
        </div>
      )}

      {categories.length === 0 ? (
        <EmptyState title="Nenhuma categoria ainda">Crie uma acima ou use uma das sugestões.</EmptyState>
      ) : (
        <div className="border-t border-border">
          {categories.map((c) => (
            <CategoryRow key={c.id} category={c} count={library.filter((e) => e.categoryIds.includes(c.id)).length} />
          ))}
        </div>
      )}

      {genres.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-1 flex items-center gap-2 font-semibold">
            <Sparkles className="size-4" /> Categorizar pelos gêneros do IGDB
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Cria a categoria (se não existir) e marca todos os jogos da biblioteca que têm esse gênero.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {genres.map((g) => (
              <Button key={g} size="sm" variant="outline" onClick={() => autoCategorize(g, g === "Indie" ? "Indies" : g)}>
                <Palette /> {g}
              </Button>
            ))}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
