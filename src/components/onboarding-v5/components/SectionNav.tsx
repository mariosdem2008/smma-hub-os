import { cn } from '@/lib/utils';

export interface SectionNavItem {
  id: string;
  title: string;
  description?: string;
  percent: number;
  requiredCompleted: number;
  requiredTotal: number;
}

interface SectionNavProps {
  items: SectionNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function SectionNav({ items, activeId, onSelect }: SectionNavProps) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Sections</div>
      <div className="space-y-1">
        {items.map((item) => {
          const isActive = item.id === activeId;
          const isComplete = item.percent >= 100;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition',
                isActive
                  ? 'border-primary/60 bg-primary/10 text-primary'
                  : 'border-border/60 hover:border-primary/40 hover:bg-muted/40'
              )}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{item.title}</div>
                {item.description && (
                  <div className="truncate text-xs text-muted-foreground">{item.description}</div>
                )}
                {item.requiredTotal > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {item.requiredCompleted}/{item.requiredTotal} required
                  </div>
                )}
              </div>
              <span
                className={cn(
                  'ml-3 h-2.5 w-2.5 rounded-full border',
                  isComplete ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground/40'
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
