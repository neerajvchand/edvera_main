import { useState, useMemo } from "react";
import type { TriageItem } from "@/hooks/useAttendanceTriage";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO, isAfter, isBefore, startOfDay } from "date-fns";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";

interface Props {
  items: TriageItem[];
  onAction: (id: string, status: string, note?: string) => void;
  isUpdating: boolean;
  onRowClick: (item: TriageItem) => void;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "new", label: "New" },
  { value: "in_review", label: "In Review" },
  { value: "needs_info", label: "Needs Info" },
  { value: "resolved", label: "Accepted" },
  { value: "corrected", label: "Corrected" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_CLASS: Record<string, string> = {
  new: "bg-destructive/15 text-destructive",
  in_review: "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-text))]",
  needs_info: "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))]",
  resolved: "bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-text))]",
  accepted: "bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-text))]",
  corrected: "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-text))]",
  rejected: "bg-destructive/10 text-destructive",
};

export function TriageHistoryView({ items, onAction, isUpdating, onRowClick }: Props) {
  const mobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (statusFilter !== "all" && i.triage_status !== statusFilter) return false;
      if (search && !(i.child_name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      if (fromDate && isBefore(parseISO(i.attendance_date), startOfDay(fromDate))) return false;
      if (toDate && isAfter(parseISO(i.attendance_date), startOfDay(toDate))) return false;
      return true;
    });
  }, [items, statusFilter, search, fromDate, toDate]);

  return (
    <div className="space-y-4 mt-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search student..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5" />
              {fromDate ? format(fromDate, "MMM d") : "From"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={fromDate}
              onSelect={setFromDate}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5" />
              {toDate ? format(toDate, "MMM d") : "To"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={toDate}
              onSelect={setToDate}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {(fromDate || toDate || statusFilter !== "all" || search) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setFromDate(undefined);
              setToDate(undefined);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</p>

      {/* Mobile: cards / Desktop: table */}
      {mobile ? (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-center py-8 text-muted-foreground text-sm">No results</p>
          )}
          {filtered.map((item) => (
            <Card key={item.id} className="cursor-pointer" onClick={() => onRowClick(item)}>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{item.child_name}</span>
                  <Badge className={cn("text-[10px]", STATUS_CLASS[item.triage_status])}>
                    {item.triage_status.replace("_", " ")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(item.attendance_date), "MMM d, yyyy")} · {item.submitted_status}
                </p>
                {item.submitted_reason && (
                  <p className="text-xs text-foreground/70">"{item.submitted_reason}"</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Student</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Reason</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Submitted</TableHead>
                <TableHead className="text-xs">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                    No results
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((item) => (
                <TableRow key={item.id} className="cursor-pointer" onClick={() => onRowClick(item)}>
                  <TableCell className="text-xs py-2.5">{format(parseISO(item.attendance_date), "MMM d")}</TableCell>
                  <TableCell className="text-xs py-2.5 font-medium">{item.child_name}</TableCell>
                  <TableCell className="text-xs py-2.5">
                    <Badge variant="outline" className="text-[10px]">{item.submitted_status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs py-2.5 max-w-[200px] truncate">{item.submitted_reason ?? "—"}</TableCell>
                  <TableCell className="text-xs py-2.5">
                    <Badge className={cn("text-[10px]", STATUS_CLASS[item.triage_status])}>
                      {item.triage_status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs py-2.5">{format(new Date(item.created_at), "MMM d, h:mm a")}</TableCell>
                  <TableCell className="text-xs py-2.5">
                    {item.resolved_at ? format(new Date(item.resolved_at), "MMM d, h:mm a") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
