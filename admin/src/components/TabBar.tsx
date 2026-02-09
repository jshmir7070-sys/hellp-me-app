import { useTabs } from '@/contexts/TabContext';
import { X, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';

export default function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, closeAllTabs, closeOtherTabs } = useTabs();
  const [contextMenuTab, setContextMenuTab] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenuTab(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuTab(tabId);
  };

  if (tabs.length <= 1) return null;

  return (
    <>
      <div className="border-b bg-muted/30 px-2 overflow-hidden">
        <div className="flex items-center gap-1 h-10 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              className={cn(
                "group flex items-center gap-2 px-3 py-1.5 text-sm rounded-t-md border border-b-0 transition-colors flex-shrink-0",
                "hover:bg-background/80",
                activeTabId === tab.id
                  ? "bg-background border-border text-foreground font-medium -mb-px"
                  : "bg-transparent border-transparent text-muted-foreground"
              )}
            >
              <span className="whitespace-nowrap max-w-[120px] overflow-hidden text-ellipsis">{tab.title}</span>
              
              {tab.hasUnsavedChanges && (
                <Circle className="h-2 w-2 fill-orange-500 text-orange-500" />
              )}
              
              {tab.closable && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={cn(
                    "p-0.5 rounded hover:bg-destructive/20 hover:text-destructive",
                    "opacity-0 group-hover:opacity-100 transition-opacity",
                    activeTabId === tab.id && "opacity-100"
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </button>
          ))}
        </div>
      </div>

      {contextMenuTab && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-popover border rounded-md shadow-lg py-1 min-w-[160px]"
          style={{ left: menuPosition.x, top: menuPosition.y }}
        >
          {tabs.find(t => t.id === contextMenuTab)?.closable && (
            <button
              onClick={() => {
                closeTab(contextMenuTab);
                setContextMenuTab(null);
              }}
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent"
            >
              탭 닫기
            </button>
          )}
          <button
            onClick={() => {
              closeOtherTabs(contextMenuTab);
              setContextMenuTab(null);
            }}
            className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent"
          >
            다른 탭 모두 닫기
          </button>
          <div className="border-t my-1" />
          <button
            onClick={() => {
              closeAllTabs();
              setContextMenuTab(null);
            }}
            className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent"
          >
            모든 탭 닫기
          </button>
        </div>
      )}
    </>
  );
}
