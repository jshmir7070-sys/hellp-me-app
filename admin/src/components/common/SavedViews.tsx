import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Bookmark } from 'lucide-react';

interface SavedView {
  id: string;
  label: string;
  count?: number;
  isActive?: boolean;
}

interface SavedViewsProps {
  views: SavedView[];
  activeView?: string;
  onSelect: (viewId: string) => void;
  className?: string;
}

export function SavedViews({ views, activeView, onSelect, className }: SavedViewsProps) {
  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      <Bookmark className="h-4 w-4 text-muted-foreground" />
      {views.map((view) => (
        <Button
          key={view.id}
          variant={activeView === view.id ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelect(view.id)}
          className="gap-1"
        >
          {view.label}
          {typeof view.count === 'number' && (
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded-full',
              activeView === view.id
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}>
              {view.count}
            </span>
          )}
        </Button>
      ))}
    </div>
  );
}
