import { X } from "lucide-react";
import { useToasts } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { items, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex max-w-sm items-start gap-2 rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-lg",
            t.tone === "error" && "border-destructive/40 text-destructive",
          )}
        >
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
