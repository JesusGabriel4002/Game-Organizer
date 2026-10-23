import { cn } from "@/lib/utils";

export function Progress({ value, className, tone = "primary" }: { value: number; className?: string; tone?: "primary" | "success" | "danger" }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = tone === "success" ? "bg-[#4dab9a]" : tone === "danger" ? "bg-destructive" : "bg-primary";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-accent-strong", className)}>
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}
