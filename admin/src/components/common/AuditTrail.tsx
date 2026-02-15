import { cn } from '@/lib/utils';
import { Clock, User, ArrowRight } from 'lucide-react';

interface AuditEvent {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  details?: string;
  oldValue?: string;
  newValue?: string;
}

interface AuditTrailProps {
  events: AuditEvent[];
  className?: string;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AuditTrail({ events, className }: AuditTrailProps) {
  if (events.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        감사 로그가 없습니다
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {events.map((event, index) => (
        <div key={event.id} className="relative flex gap-4">
          {index < events.length - 1 && (
            <div className="absolute left-3 top-8 bottom-0 w-px bg-border" />
          )}
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="h-3 w-3 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{event.action}</span>
              <span className="text-muted-foreground">by</span>
              <span className="inline-flex items-center gap-1 text-primary">
                <User className="h-3 w-3" />
                {event.actor}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {formatTimestamp(event.timestamp)}
            </div>
            {event.details && (
              <p className="text-sm text-muted-foreground mt-1">{event.details}</p>
            )}
            {(event.oldValue || event.newValue) && (
              <div className="flex items-center gap-2 text-xs mt-1 p-2 bg-muted rounded">
                <span className="text-red-600 line-through">{event.oldValue || '-'}</span>
                <ArrowRight className="h-3 w-3" />
                <span className="text-green-600">{event.newValue || '-'}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
