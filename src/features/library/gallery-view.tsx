import { useNavigate } from "react-router-dom";
import { statusDetail } from "@/lib/completion";
import { useCategories } from "@/lib/queries";
import type { LibraryEntry } from "@/lib/types";
import { Cover } from "@/components/game/cover";
import { ScoreBadge } from "@/components/game/score-badge";
import { CategoryTags, StatusTag } from "@/components/game/tags";

export function GalleryView({ entries }: { entries: LibraryEntry[] }) {
  const navigate = useNavigate();
  const { data: categories = [] } = useCategories();
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4">
      {entries.map((e) => (
        <button
          key={e.id}
          onClick={() => navigate(`/game/${e.id}`)}
          className="group overflow-hidden rounded-lg border border-border bg-background text-left shadow-sm transition hover:shadow-md"
        >
          <div className="relative aspect-[3/4] overflow-hidden bg-accent">
            <Cover url={e.coverUrl} name={e.name} className="size-full transition-transform duration-300 group-hover:scale-[1.03]" />
            <ScoreBadge entry={e} />
          </div>
          <div className="space-y-1.5 p-2.5">
            <p className="truncate text-sm font-medium">{e.name}</p>
            <StatusTag status={e.status} detail={statusDetail(e)} />
            <CategoryTags ids={e.categoryIds} categories={categories} max={2} />
          </div>
        </button>
      ))}
    </div>
  );
}
