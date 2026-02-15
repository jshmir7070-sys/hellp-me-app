import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
      <div
        className={cn(
          "h-4 w-4 rounded border border-gray-300 flex items-center justify-center cursor-pointer transition-colors",
          checked ? "bg-blue-600 border-blue-600" : "bg-white hover:border-gray-400",
          className
        )}
        onClick={() => onCheckedChange?.(!checked)}
      >
        {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="sr-only"
          {...props}
        />
      </div>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
