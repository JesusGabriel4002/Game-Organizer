import { Gamepad2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocalCover } from "@/lib/covers";
import { cn } from "@/lib/utils";

export function Cover({ url, name, className }: { url: string | null; name: string; className?: string }) {
  const local = useLocalCover(url);
  // Local copy first; if it can't be read, the remote URL; then the placeholder.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [url, local]);
  const src = attempt === 0 ? local : attempt === 1 && local !== url ? url : null;

  if (!src) {
    return (
      <div className={cn("flex items-center justify-center bg-accent-strong text-muted-foreground", className)}>
        <Gamepad2 className="size-1/3 max-h-10 max-w-10" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      draggable={false}
      onError={() => setAttempt((a) => a + 1)}
      className={cn("object-cover", className)}
    />
  );
}
