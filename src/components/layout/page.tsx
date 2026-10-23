import { cn } from "@/lib/utils";

export function PageHeader({
  icon,
  title,
  description,
  actions,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="mb-2 text-4xl leading-none">{icon}</div>
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
      {description && <p className="mt-1 text-muted-foreground">{description}</p>}
    </div>
  );
}

export function PageContainer({ children, wide, className }: { children: React.ReactNode; wide?: boolean; className?: string }) {
  return (
    <div className={cn("mx-auto px-12 pb-24 pt-14", wide ? "max-w-[1400px]" : "max-w-4xl", className)}>{children}</div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
