import React, { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

export interface ColumnDef<T> {
  key: string;
  header: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  frozen?: boolean;
}

interface ExcelTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T, index: number) => void;
  selectedRowId?: string | number | null;
  getRowId?: (row: T) => string | number;
  stickyHeader?: boolean;
  maxHeight?: string | number;
  className?: string;
  storageKey?: string;
  selectable?: boolean;
  selectedIds?: Set<string | number>;
  onSelectionChange?: (selectedIds: Set<string | number>) => void;
}

const DEFAULT_WIDTH = 120;
const MIN_WIDTH = 50;
const RESIZE_HANDLE_WIDTH = 4;

export function ExcelTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  emptyMessage = "데이터가 없습니다",
  onRowClick,
  selectedRowId,
  getRowId,
  stickyHeader = true,
  maxHeight = "calc(100vh - 280px)",
  className,
  storageKey,
  selectable = false,
  selectedIds = new Set(),
  onSelectionChange,
}: ExcelTableProps<T>) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (storageKey) {
      const saved = localStorage.getItem(`excel-table-widths-${storageKey}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return {};
        }
      }
    }
    return {};
  });

  const [resizing, setResizing] = useState<{ key: string; startX: number; startWidth: number } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (storageKey && Object.keys(columnWidths).length > 0) {
      localStorage.setItem(`excel-table-widths-${storageKey}`, JSON.stringify(columnWidths));
    }
  }, [columnWidths, storageKey]);

  const getColumnWidth = useCallback(
    (col: ColumnDef<T>) => {
      return columnWidths[col.key] || col.width || DEFAULT_WIDTH;
    },
    [columnWidths]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, col: ColumnDef<T>) => {
      e.preventDefault();
      e.stopPropagation();
      setResizing({
        key: col.key,
        startX: e.clientX,
        startWidth: getColumnWidth(col),
      });
    },
    [getColumnWidth]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!resizing) return;

      const diff = e.clientX - resizing.startX;
      const col = columns.find((c) => c.key === resizing.key);
      const minW = col?.minWidth || MIN_WIDTH;
      const maxW = col?.maxWidth || 800;
      const newWidth = Math.min(maxW, Math.max(minW, resizing.startWidth + diff));

      setColumnWidths((prev) => ({
        ...prev,
        [resizing.key]: newWidth,
      }));
    },
    [resizing, columns]
  );

  const handleMouseUp = useCallback(() => {
    setResizing(null);
  }, []);

  useEffect(() => {
    if (resizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizing, handleMouseMove, handleMouseUp]);

  const totalWidth = columns.reduce((sum, col) => sum + getColumnWidth(col), 0) + (selectable ? 40 : 0);

  const allIds = data.map((row, index) => getRowId ? getRowId(row) : index);
  const allSelected = data.length > 0 && allIds.every(id => selectedIds.has(id));
  const someSelected = allIds.some(id => selectedIds.has(id));

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(allIds));
    }
  };

  const handleSelectRow = (rowId: string | number) => {
    if (!onSelectionChange) return;
    const newSelection = new Set(selectedIds);
    if (newSelection.has(rowId)) {
      newSelection.delete(rowId);
    } else {
      newSelection.add(rowId);
    }
    onSelectionChange(newSelection);
  };

  return (
    <div
      ref={tableRef}
      className={cn(
        "border border-gray-300 rounded-md overflow-hidden bg-white",
        className
      )}
      style={{ maxHeight }}
    >
      <div className="overflow-auto" style={{ maxHeight }}>
        <table
          className="border-collapse"
          style={{ width: totalWidth, minWidth: "100%", tableLayout: "fixed" }}
        >
          <thead className={cn(stickyHeader && "sticky top-0 z-10")}>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              {selectable && (
                <th
                  className="w-10 px-2 py-2 text-center bg-gradient-to-b from-gray-50 to-gray-100 border-r border-gray-300"
                  style={{ width: 40, minWidth: 40 }}
                >
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    className={cn(someSelected && !allSelected && "data-[state=checked]:bg-gray-400")}
                  />
                </th>
              )}
              {columns.map((col, colIndex) => (
                <th
                  key={col.key}
                  className={cn(
                    "relative px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300 select-none",
                    "bg-gradient-to-b from-gray-50 to-gray-100",
                    col.frozen && "sticky left-0 z-20 bg-gray-100",
                    col.align === "center" && "text-center",
                    col.align === "right" && "text-right"
                  )}
                  style={{ width: getColumnWidth(col), minWidth: getColumnWidth(col) }}
                >
                  <div className="truncate pr-2">{col.header}</div>
                  {colIndex < columns.length - 1 && (
                    <div
                      className={cn(
                        "absolute top-0 right-0 h-full cursor-col-resize hover:bg-blue-400 transition-colors",
                        resizing?.key === col.key && "bg-blue-500"
                      )}
                      style={{ width: RESIZE_HANDLE_WIDTH }}
                      onMouseDown={(e) => handleMouseDown(e, col)}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="text-center py-8 text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    로딩 중...
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="text-center py-8 text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => {
                const rowId = getRowId ? getRowId(row) : rowIndex;
                const isSelected = selectedRowId !== undefined && rowId === selectedRowId;
                const isChecked = selectedIds.has(rowId);

                return (
                  <tr
                    key={rowId}
                    className={cn(
                      "border-b border-gray-200 transition-colors",
                      rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50",
                      onRowClick && "cursor-pointer hover:bg-blue-50",
                      isSelected && "bg-blue-100 hover:bg-blue-100",
                      isChecked && "bg-blue-50"
                    )}
                    onClick={() => onRowClick?.(row, rowIndex)}
                  >
                    {selectable && (
                      <td
                        className="w-10 px-2 py-2 text-center border-r border-gray-200"
                        style={{ width: 40, minWidth: 40 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => handleSelectRow(rowId)}
                        />
                      </td>
                    )}
                    {columns.map((col) => {
                      const value = row[col.key];
                      const rendered = col.render ? col.render(value, row, rowIndex) : value;

                      return (
                        <td
                          key={col.key}
                          className={cn(
                            "px-3 py-2 text-sm border-r border-gray-200 overflow-hidden",
                            col.frozen && "sticky left-0 z-10 bg-inherit",
                            col.align === "center" && "text-center",
                            col.align === "right" && "text-right"
                          )}
                          style={{
                            width: getColumnWidth(col),
                            minWidth: getColumnWidth(col),
                            maxWidth: getColumnWidth(col),
                          }}
                        >
                          <div className="truncate">{rendered ?? "-"}</div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-300 text-xs text-gray-600 flex justify-between items-center">
        <span>총 {data.length}건</span>
        <span className="text-gray-400">열 너비 조절: 헤더 경계선을 드래그하세요</span>
      </div>
    </div>
  );
}

export default ExcelTable;
