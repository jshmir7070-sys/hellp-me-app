import * as React from "react";
import { cn } from "@/lib/utils";

interface TableContextValue {
  columnWidths: Record<string, number>;
  setColumnWidth: (key: string, width: number) => void;
  resizing: { key: string; startX: number; startWidth: number } | null;
  setResizing: (resizing: { key: string; startX: number; startWidth: number } | null) => void;
}

const TableContext = React.createContext<TableContextValue | null>(null);

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & { 
    stickyHeader?: boolean;
    maxHeight?: string;
    storageKey?: string;
  }
>(({ className, stickyHeader = true, maxHeight, storageKey, children, ...props }, ref) => {
  const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>(() => {
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(`table-widths-${storageKey}`);
      if (saved) {
        try { return JSON.parse(saved); } catch { return {}; }
      }
    }
    return {};
  });
  const [resizing, setResizing] = React.useState<{ key: string; startX: number; startWidth: number } | null>(null);

  React.useEffect(() => {
    if (storageKey && Object.keys(columnWidths).length > 0) {
      localStorage.setItem(`table-widths-${storageKey}`, JSON.stringify(columnWidths));
    }
  }, [columnWidths, storageKey]);

  const setColumnWidth = React.useCallback((key: string, width: number) => {
    setColumnWidths(prev => ({ ...prev, [key]: width }));
  }, []);

  React.useEffect(() => {
    if (!resizing) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizing.startX;
      const newWidth = Math.max(50, Math.min(500, resizing.startWidth + diff));
      setColumnWidth(resizing.key, newWidth);
    };

    const handleMouseUp = () => {
      setResizing(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, setColumnWidth]);

  return (
    <TableContext.Provider value={{ columnWidths, setColumnWidth, resizing, setResizing }}>
      <div 
        className={cn(
          "relative w-full border border-gray-200 rounded-lg bg-white overflow-hidden",
          className
        )}
      >
        <div 
          className="overflow-auto" 
          style={maxHeight ? { maxHeight } : undefined}
        >
          <table
            ref={ref}
            className={cn(
              "w-full caption-bottom text-sm border-collapse",
              stickyHeader && "[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10"
            )}
            {...props}
          >
            {children}
          </table>
        </div>
        <div className="px-3 py-1.5 bg-gray-50 border-t text-xs text-gray-500 flex justify-end">
          <span>열 너비 조절: 헤더 경계선 드래그</span>
        </div>
      </div>
    </TableContext.Provider>
  );
});
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead 
    ref={ref} 
    className={cn(
      "bg-gradient-to-b from-gray-50 to-gray-100 border-b-2 border-gray-300",
      className
    )} 
    {...props} 
  />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-gray-200 transition-colors hover:bg-blue-50/50 data-[state=selected]:bg-blue-100",
      "even:bg-gray-50/50",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & { resizeKey?: string }
>(({ className, resizeKey, style, children, ...props }, ref) => {
  const context = React.useContext(TableContext);
  const cellRef = React.useRef<HTMLTableCellElement>(null);
  
  const width = resizeKey && context?.columnWidths[resizeKey];
  const isResizing = resizeKey && context?.resizing?.key === resizeKey;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!resizeKey || !context || !cellRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    context.setResizing({
      key: resizeKey,
      startX: e.clientX,
      startWidth: cellRef.current.offsetWidth,
    });
  };

  return (
    <th
      ref={(node) => {
        (cellRef as React.MutableRefObject<HTMLTableCellElement | null>).current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      className={cn(
        "relative h-11 px-3 text-left align-middle font-bold text-xs text-gray-700 uppercase tracking-wider",
        "border-r border-gray-300 last:border-r-0 select-none",
        "[&:has([role=checkbox])]:pr-0",
        className
      )}
      style={{ 
        ...style, 
        ...(width ? { width, minWidth: width, maxWidth: width } : {}) 
      }}
      {...props}
    >
      <div className="truncate pr-2">{children}</div>
      {resizeKey && (
        <div
          className={cn(
            "absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-blue-400 transition-colors",
            isResizing && "bg-blue-500"
          )}
          onMouseDown={handleMouseDown}
        />
      )}
    </th>
  );
});
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "px-3 py-2.5 align-middle border-r border-gray-100 last:border-r-0",
      "[&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
