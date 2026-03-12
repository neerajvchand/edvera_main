import { useState, useEffect, useMemo, useCallback } from "react";
import { getActionList, type SchoolOption } from "@/services/actions/getActionList";
import { getActionStats } from "@/services/actions/getActionStats";
import type { ActionListItem, ActionStats } from "@/types/action";
import { getDueDateInfo, PRIORITY_SORT_ORDER } from "@/components/action-center/actionCenterConstants";

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useActionCenter() {
  const [actions, setActions] = useState<ActionListItem[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("open");
  const [typeFilter, setTypeFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [sortBy, setSortBy] = useState("due_date_asc");
  const [searchQuery, setSearchQuery] = useState("");

  // ---- Fetch data via service ----
  useEffect(() => {
    getActionList()
      .then(({ actions: a, schools: s }) => {
        setActions(a);
        setSchools(s);
      })
      .catch((err) => console.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  // ---- Computed metrics ----
  const metrics = useMemo<ActionStats>(
    () =>
      getActionStats(actions, (dueDate) => getDueDateInfo(dueDate).isOverdue),
    [actions]
  );

  // ---- Filtered and sorted actions ----
  const filteredActions = useMemo(() => {
    let result = [...actions];

    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
    }
    if (typeFilter !== "all") {
      result = result.filter((a) => a.action_type === typeFilter);
    }
    if (schoolFilter !== "all") {
      result = result.filter((a) => a.school_id === schoolFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.student_name.toLowerCase().includes(q) ||
          a.title.toLowerCase().includes(q) ||
          (a.reason ?? "").toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "due_date_asc":
          return a.due_date.localeCompare(b.due_date);
        case "due_date_desc":
          return b.due_date.localeCompare(a.due_date);
        case "priority_desc": {
          const pa = PRIORITY_SORT_ORDER[a.priority] ?? 99;
          const pb = PRIORITY_SORT_ORDER[b.priority] ?? 99;
          if (pa !== pb) return pa - pb;
          return a.due_date.localeCompare(b.due_date);
        }
        case "created_at_desc":
          return b.created_at.localeCompare(a.created_at);
        default:
          return 0;
      }
    });

    return result;
  }, [actions, statusFilter, typeFilter, schoolFilter, sortBy, searchQuery]);

  const hasFilters =
    statusFilter !== "open" ||
    typeFilter !== "all" ||
    schoolFilter !== "all" ||
    searchQuery.trim() !== "";

  const resetFilters = useCallback(() => {
    setStatusFilter("open");
    setTypeFilter("all");
    setSchoolFilter("all");
    setSearchQuery("");
  }, []);

  return {
    loading,
    actions,
    schools,
    metrics,
    filteredActions,
    hasFilters,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    schoolFilter,
    setSchoolFilter,
    sortBy,
    setSortBy,
    searchQuery,
    setSearchQuery,
    resetFilters,
  };
}
