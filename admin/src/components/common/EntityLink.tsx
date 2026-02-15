import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

type EntityType = 'order' | 'contract' | 'payment' | 'settlement' | 'user' | 'dispute';

interface EntityLinkProps {
  type: EntityType;
  id: string | number;
  label?: string;
  className?: string;
  showIcon?: boolean;
}

const entityPaths: Record<EntityType, string> = {
  order: '/orders',
  contract: '/contracts',
  payment: '/payments',
  settlement: '/settlements',
  user: '/users',
  dispute: '/disputes',
};

const entityPrefixes: Record<EntityType, string> = {
  order: 'ORD',
  contract: 'CTR',
  payment: 'PAY',
  settlement: 'STL',
  user: 'USR',
  dispute: 'DSP',
};

export function EntityLink({ type, id, label, className, showIcon = false }: EntityLinkProps) {
  const path = `${entityPaths[type]}?id=${id}`;
  const displayLabel = label || `${entityPrefixes[type]}-${id}`;

  return (
    <Link
      to={path}
      className={cn(
        'inline-flex items-center gap-1 text-primary hover:underline font-mono text-sm',
        className
      )}
    >
      {displayLabel}
      {showIcon && <ExternalLink className="h-3 w-3" />}
    </Link>
  );
}
