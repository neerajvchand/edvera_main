import { cn } from "@/lib/utils";
import { ChevronDown, Search } from "lucide-react";
import {
  STATUS_FILTERS,
  TYPE_FILTERS,
  SORT_OPTIONS,
  type SchoolOption,
} from "./actionCenterConstants";
import { CARD } from "@/lib/designTokens";

interface ActionFilterBarProps {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  typeFilter: string;
  onTypeChange: (v: string) => void;
  schoolFilter: string;
  onSchoolChange: (v: string) => void;
  sortBy: string;
  onSortChange: (v: string) => void;
  schools: SchoolOption[];
  hasFilters: boolean;
  filteredCount: number;
  onReset: () => void;
}

export function ActionFilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  typeFilter,
  onTypeChange,
  schoolFilter,
  onSchoolChange,
  sortBy,
  onSortChange,
  schools,
  hasFilters,
  filteredCount,
  onReset,
}: ActionFilterBarProps) {
  return (
    <div className={`${CARD} p-4 mb-6`}>
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search student or action..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        {/* Status pills */}
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => onStatusChange(f.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                statusFilter === f.value
                  ? "bg-blue-50 text-blue-800 font-semibold"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => onTypeChange(e.target.value)}
            className="appearance-none bg-gray-100 text-xs font-medium text-gray-600 rounded-full pl-3 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer hover:bg-gray-200 transition-colors"
          >
            {TYPE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        </div>

        {/* School filter */}
        <div className="relative">
          <select
            value={schoolFilter}
            onChange={(e) => onSchoolChange(e.target.value)}
            className="appearance-none bg-gray-100 text-xs font-medium text-gray-600 rounded-full pl-3 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer hover:bg-gray-200 transition-colors"
          >
            <option value="all">All Schools</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        </div>

        {/* Sort */}
        <div className="relative ml-auto">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="appearance-none bg-gray-100 text-xs font-medium text-gray-600 rounded-full pl-3 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer hover:bg-gray-200 transition-colors"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Active filter count */}
      {hasFilters && statusFilter !== "open" && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {filteredCount} action
            {filteredCount !== 1 ? "s" : ""} match
          </span>
          <button
            onClick={onReset}
            className="text-xs text-brand-500 hover:text-brand-600 font-medium"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
