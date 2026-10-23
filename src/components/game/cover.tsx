import { Gamepad2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function Cover({ url, name, className }: { url: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <div className={cn("flex items-center justify-center bg-accent-strong text-muted-foreground", className)}>
        <Gamepad2 className="size-1/3 max-h-10 max-w-10" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={name}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  );
}
