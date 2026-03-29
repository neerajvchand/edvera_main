import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import type { TriageItem } from "@/hooks/useAttendanceTriage";
import { CompactTriageCard } from "./CompactTriageCard";
import { TriageCard } from "./TriageCard";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

type Density = "compact" | "detailed";

interface Props {
  items: TriageItem[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  onAction: (id: string, status: string, note?: string) => void;
  isUpdating: boolean;
  onRowClick: (item: TriageItem) => void;
  density: Density;
}

function categorize(item: TriageItem): string {
  const s = (item.submitted_status ?? "").toLowerCase();
  if (s.includes("tardy") || s.includes("late")) return "Running Late";
  if (s.includes("early") || s.includes("leaving")) return "Leaving Early";
  if (s.includes("absent")) return "Absent Today";
  return "Other";
}

const SECTION_ORDER = ["Running Late", "Leaving Early", "Absent Today", "Other"];

export function MorningRushView({
  items,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  onAction,
  isUpdating,
  onRowClick,
  density,
}: Props) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [focusIdx, setFocusIdx] = useState(-1);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const grouped = useMemo(() => {
    const map: Record<string, TriageItem[]> = {};
    SECTION_ORDER.forEach((s) => (map[s] = []));
    items.forEach((i) => {
      const cat = categorize(i);
      if (!map[cat]) map[cat] = [];
      map[cat].push(i);
    });
    // Sort by updated_at DESC so reopened/corrected items surface first
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at))
    );
    return map;
  }, [items]);

  // Flat list for keyboard nav
  const flatItems = useMemo(() => {
    const result: TriageItem[] = [];
    SECTION_ORDER.forEach((section) => {
      const sectionItems = grouped[section];
      if (sectionItems?.length && !collapsedSections.has(section)) {
        result.push(...sectionItems);
      }
    });
    return result;
  }, [grouped, collapsedSections]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (density !== "compact") return;
      // Don't capture if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIdx((prev) => Math.min(prev + 1, flatItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && focusIdx >= 0 && focusIdx < flatItems.length) {
        e.preventDefault();
        const item = flatItems[focusIdx];
        if (["new", "in_review", "needs_info"].includes(item.triage_status)) {
          onAction(item.id, "resolved");
        }
      } else if ((e.key === "n" || e.key === "N") && focusIdx >= 0 && focusIdx < flatItems.length) {
        e.preventDefault();
        const item = flatItems[focusIdx];
        if (["new", "in_review", "needs_info"].includes(item.triage_status)) {
          onAction(item.id, "needs_info");
        }
      } else if ((e.key === "r" || e.key === "R") && focusIdx >= 0 && focusIdx < flatItems.length) {
        e.preventDefault();
        const item = flatItems[focusIdx];
        if (["new", "in_review", "needs_info"].includes(item.triage_status)) {
          onAction(item.id, "rejected");
        }
      }
    },
    [density, flatItems, focusIdx, onAction]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Scroll focused card into view
  useEffect(() => {
    if (focusIdx >= 0 && cardRefs.current[focusIdx]) {
      cardRefs.current[focusIdx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [focusIdx]);

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const collapseAll = () => setCollapsedSections(new Set(SECTION_ORDER));
  const expandAll = () => setCollapsedSections(new Set());

  const anySelected = selected.size > 0;
  let flatIdx = 0;

  return (
    <div className="space-y-3 mt-3">
      {/* Collapse controls + keyboard hint */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 px-2" onClick={expandAll}>
            <ChevronsUpDown className="w-3 h-3" /> Expand all
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 px-2" onClick={collapseAll}>
            <ChevronsDownUp className="w-3 h-3" /> Collapse all
          </Button>
        </div>
        {density === "compact" && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-secondary rounded-md px-2 py-1">
            <Keyboard className="w-3 h-3" />
            <span>↑↓ Navigate · Enter=Accept · N=Needs Info · R=Reject</span>
          </div>
        )}
      </div>

      {items.length === 0 && (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">No attendance notices for today</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Check back during school hours</p>
        </div>
      )}

      {SECTION_ORDER.map((section) => {
        const sectionItems = grouped[section];
        if (!sectionItems || sectionItems.length === 0) return null;
        const isOpen = !collapsedSections.has(section);
        const newInSection = sectionItems.filter((i) => i.triage_status === "new").length;

        return (
          <Collapsible key={section} open={isOpen} onOpenChange={() => toggleSection(section)}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full py-1.5 group cursor-pointer">
                <div className="flex items-center gap-2">
                  {isOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <h3 className="text-sm font-semibold text-foreground tracking-tight">{section}</h3>
                  {newInSection > 0 && (
                    <span className="text-[10px] bg-destructive/15 text-destructive px-1.5 py-0.5 rounded-full font-medium">
                      {newInSection} new
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {sectionItems.length} notice{sectionItems.length !== 1 ? "s" : ""}
                </span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1.5 mt-1">
                {sectionItems.map((item) => {
                  const currentFlatIdx = flatIdx++;
                  if (density === "compact") {
                    return (
                      <CompactTriageCard
                        key={item.id}
                        ref={(el) => { cardRefs.current[currentFlatIdx] = el; }}
                        item={item}
                        isSelected={selected.has(item.id)}
                        anySelected={anySelected}
                        onToggleSelect={() => onToggleSelect(item.id)}
                        onAction={onAction}
                        isUpdating={isUpdating}
                        onRowClick={() => onRowClick(item)}
                        isFocused={focusIdx === currentFlatIdx}
                      />
                    );
                  }
                  return (
                    <TriageCard
                      key={item.id}
                      item={item}
                      isSelected={selected.has(item.id)}
                      onToggleSelect={() => onToggleSelect(item.id)}
                      onAction={onAction}
                      isUpdating={isUpdating}
                      onRowClick={() => onRowClick(item)}
                    />
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
