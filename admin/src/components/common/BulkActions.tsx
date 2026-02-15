import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CheckSquare, X } from 'lucide-react';

interface BulkAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline';
  onClick: () => void;
}

interface BulkActionsProps {
  selectedCount: number;
  actions: BulkAction[];
  onClearSelection: () => void;
  className?: string;
}

export function BulkActions({ selectedCount, actions, onClearSelection, className }: BulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className={cn(
      'flex items-center gap-4 p-3 bg-primary/10 rounded-lg border border-primary/20',
      className
    )}>
      <div className="flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{selectedCount}개 선택됨</span>
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.id}
            variant={action.variant || 'outline'}
            size="sm"
            onClick={action.onClick}
            className="gap-1"
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
