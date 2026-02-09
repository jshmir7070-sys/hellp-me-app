import { cn } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { ExternalLink } from 'lucide-react';

interface UserCellProps {
  name: string;
  id?: string | number;
  phone?: string;
  role?: 'helper' | 'requester' | 'admin';
  status?: string;
  className?: string;
  showMasked?: boolean;
  onClick?: () => void;
  clickable?: boolean;
}

function maskPhone(phone: string): string {
  if (phone.length < 8) return phone;
  return phone.slice(0, 3) + '-****-' + phone.slice(-4);
}

export function UserCell({ name, id, phone, role, status, className, showMasked = true, onClick, clickable = false }: UserCellProps) {
  const roleColors = {
    helper: 'text-blue-600',
    requester: 'text-emerald-600',
    admin: 'text-purple-600',
  };

  const isClickable = clickable || !!onClick;

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-0.5',
        isClickable && 'cursor-pointer hover:bg-muted/50 rounded p-1 -m-1 transition-colors group',
        className
      )}
      onClick={isClickable ? handleClick : undefined}
    >
      <div className="flex items-center gap-2">
        <span className={cn(
          'font-medium',
          role && roleColors[role],
          isClickable && 'group-hover:underline'
        )}>
          {name}
        </span>
        {isClickable && (
          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
        {status && <StatusBadge status={status} />}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {id && <span>#{id}</span>}
        {phone && <span>{showMasked ? maskPhone(phone) : phone}</span>}
      </div>
    </div>
  );
}
