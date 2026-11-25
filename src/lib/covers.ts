import { convertFileSrc } from "@tauri-apps/api/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { covers } from "./api";
import { useLibrary } from "./queries";

/** Remote cover URL → webview URL of the local copy. */
type CoverMap = Record<string, string>;

const COVERS_KEY = ["cover-cache"] as const;
const BATCH = 40;

export function useCoverMap() {
  return useQuery<CoverMap>({ queryKey: COVERS_KEY, queryFn: () => ({}), staleTime: Infinity, gcTime: Infinity }).data;
}

/** The local copy when there is one, otherwise the remote URL. */
export function useLocalCover(url: string | null): string | null {
  const map = useCoverMap();
  if (!url) return null;
  return map?.[url] ?? url;
}

/** Downloads the cover of every library game in the background, once per URL. */
export function useCoverCache() {
  const qc = useQueryClient();
  const { data: library } = useLibrary();
  const tried = useRef(new Set<string>());
  const running = useRef(false);

  useEffect(() => {
    if (!library || running.current) return;
    const pending = [...new Set(library.flatMap((e) => (e.coverUrl ? [e.coverUrl] : [])))].filter(
      (u) => !tried.current.has(u),
    );
    if (!pending.length) return;
    running.current = true;
    void (async () => {
      try {
        for (let i = 0; i < pending.length; i += BATCH) {
          const batch = pending.slice(i, i + BATCH);
          batch.forEach((u) => tried.current.add(u));
          const found = await covers.cache(batch);
          const mapped = Object.fromEntries(Object.entries(found).map(([u, path]) => [u, convertFileSrc(path)]));
          qc.setQueryData<CoverMap>(COVERS_KEY, (prev) => ({ ...prev, ...mapped }));
        }
      } catch {
        // Offline or no disk access: covers keep loading from the web.
      } finally {
        running.current = false;
      }
    })();
  }, [library, qc]);
}

/** Forgets the local copies (after clearing the folder) so they are downloaded again. */
export function useResetCoverCache() {
  const qc = useQueryClient();
  return () => qc.setQueryData<CoverMap>(COVERS_KEY, {});
}
