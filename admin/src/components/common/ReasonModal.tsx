import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { X, AlertTriangle } from 'lucide-react';

interface ReasonTemplate {
  id: string;
  label: string;
  text: string;
}

interface ReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  title: string;
  description?: string;
  submitText?: string;
  variant?: 'default' | 'destructive';
  isLoading?: boolean;
  templates?: ReasonTemplate[];
  required?: boolean;
  minLength?: number;
}

export function ReasonModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  description,
  submitText = '확인',
  variant = 'default',
  isLoading = false,
  templates = [],
  required = true,
  minLength = 10,
}: ReasonModalProps) {
  const [reason, setReason] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTemplateSelect = (template: ReasonTemplate) => {
    setSelectedTemplate(template.id);
    setReason(template.text);
  };

  const handleSubmit = () => {
    if (required && reason.length < minLength) return;
    onSubmit(reason);
    setReason('');
    setSelectedTemplate(null);
  };

  const isValid = !required || reason.length >= minLength;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-background rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between p-6 border-b">
          <div className="flex items-start gap-4">
            {variant === 'destructive' && (
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold">{title}</h3>
              {description && (
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-4">
          {templates.length > 0 && (
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">
                사유 템플릿
              </Label>
              <div className="flex flex-wrap gap-2">
                {templates.map((template) => (
                  <Button
                    key={template.id}
                    variant={selectedTemplate === template.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleTemplateSelect(template)}
                  >
                    {template.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="reason" className="text-sm text-muted-foreground mb-2 block">
              사유 {required && <span className="text-destructive">*</span>}
            </Label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setSelectedTemplate(null);
              }}
              placeholder={`최소 ${minLength}자 이상 입력하세요`}
              className="w-full min-h-[100px] px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex justify-between mt-1">
              <span className={cn(
                'text-xs',
                reason.length < minLength ? 'text-muted-foreground' : 'text-green-600'
              )}>
                {reason.length}/{minLength}자 이상
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            취소
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={handleSubmit}
            disabled={isLoading || !isValid}
          >
            {isLoading ? '처리중...' : submitText}
          </Button>
        </div>
      </div>
    </>
  );
}
