import { cn } from '@/lib/utils';

interface MoneyProps {
  amount: number;
  showVat?: boolean;
  vatRate?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Money({ amount, showVat = false, vatRate = 0.1, className, size = 'md' }: MoneyProps) {
  const formattedAmount = amount.toLocaleString('ko-KR');
  const vatAmount = Math.round(amount * vatRate);

  const sizeStyles = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg font-semibold',
  };

  return (
    <span className={cn('tabular-nums', sizeStyles[size], className)}>
      {formattedAmount}원
      {showVat && (
        <span className="text-xs text-muted-foreground ml-1">
          (VAT {vatAmount.toLocaleString()}원)
        </span>
      )}
    </span>
  );
}
