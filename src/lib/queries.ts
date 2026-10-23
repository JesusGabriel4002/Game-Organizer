import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as db from "./db";
import type { CompletionInput, EntryPatch, GameStatus, GoalInput, IgdbGame, LibraryEntry, TagColor } from "./types";
import { toast } from "./toast";
import { errorMessage } from "./utils";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: Infinity, refetchOnWindowFocus: false, retry: false },
    mutations: { onError: (err) => toast.error(errorMessage(err)) },
  },
});

export const keys = {
  library: ["library"] as const,
  categories: ["categories"] as const,
  goals: ["goals"] as const,
};

export function useLibrary() {
  return useQuery({ queryKey: keys.library, queryFn: db.listLibrary });
}

export function useEntry(id: string | undefined) {
  const library = useLibrary();
  return { ...library, data: library.data?.find((e) => e.id === id) };
}

export function useCategories() {
  return useQuery({ queryKey: keys.categories, queryFn: db.listCategories });
}

export function useGoals() {
  return useQuery({ queryKey: keys.goals, queryFn: db.listGoals });
}

function useInvalidate() {
  const qc = useQueryClient();
  return (...ks: (readonly string[])[]) => Promise.all(ks.map((k) => qc.invalidateQueries({ queryKey: k })));
}

export function useUpdateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entry, patch }: { entry: LibraryEntry; patch: EntryPatch }) => db.updateEntry(entry.id, patch, entry),
    onMutate: async ({ entry, patch }) => {
      // Optimistic update keeps drag-and-drop and inline edits snappy.
      await qc.cancelQueries({ queryKey: keys.library });
      const previous = qc.getQueryData<LibraryEntry[]>(keys.library);
      const derived: EntryPatch = patch.completedAt ? { completedYear: Number(patch.completedAt.slice(0, 4)) } : {};
      qc.setQueryData<LibraryEntry[]>(keys.library, (list) =>
        list?.map((e) => (e.id === entry.id ? { ...e, ...patch, ...derived } : e)),
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(keys.library, ctx.previous);
      toast.error(errorMessage(err));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.library }),
  });
}

export function useAddFromIgdb() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ game, status, completion }: { game: IgdbGame; status: GameStatus; completion?: CompletionInput }) =>
      db.addFromIgdb(game, status, completion),
    onSuccess: () => invalidate(keys.library),
  });
}

export function useAddManual() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ name, status, completion }: { name: string; status: GameStatus; completion?: CompletionInput }) =>
      db.addManual(name, status, completion),
    onSuccess: () => invalidate(keys.library),
  });
}

export function useDeleteEntry() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => db.deleteEntry(id),
    onSuccess: () => invalidate(keys.library, keys.goals),
  });
}

export function useSetEntryCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, categoryIds }: { entryId: string; categoryIds: string[] }) =>
      db.setEntryCategories(entryId, categoryIds),
    onMutate: ({ entryId, categoryIds }) => {
      qc.setQueryData<LibraryEntry[]>(keys.library, (list) =>
        list?.map((e) => (e.id === entryId ? { ...e, categoryIds } : e)),
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.library }),
  });
}

export function useCreateCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ name, color }: { name: string; color: TagColor }) => db.createCategory(name, color),
    onSuccess: () => invalidate(keys.categories),
  });
}

export function useUpdateCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name?: string; color?: TagColor }) => db.updateCategory(id, patch),
    onSuccess: () => invalidate(keys.categories),
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => db.deleteCategory(id),
    onSuccess: () => invalidate(keys.categories, keys.library, keys.goals),
  });
}

export function useSaveGoal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ input, id }: { input: GoalInput; id?: string }) => db.saveGoal(input, id),
    onSuccess: () => invalidate(keys.goals),
  });
}

export function useDeleteGoal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => db.deleteGoal(id),
    onSuccess: () => invalidate(keys.goals),
  });
}
