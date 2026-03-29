import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useChildren, Child } from "@/hooks/useChildren";
import { useSchool, SchoolRecord } from "@/hooks/useSchool";

interface SelectedChildContextValue {
  selectedChild: Child | null;
  setSelectedChildId: (id: string) => void;
  children: Child[];
  isLoading: boolean;
  /** The school derived from the active child's school_id */
  school: SchoolRecord | null;
  schoolLoading: boolean;
}

const SelectedChildContext = createContext<SelectedChildContextValue>({
  selectedChild: null,
  setSelectedChildId: () => {},
  children: [],
  isLoading: true,
  school: null,
  schoolLoading: true,
});

export function SelectedChildProvider({ children: reactChildren }: { children: ReactNode }) {
  const { children, isLoading } = useChildren();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Auto-select first child when data loads
  useEffect(() => {
    if (children.length > 0 && !selectedId) {
      setSelectedId(children[0].id);
    }
  }, [children, selectedId]);

  const selectedChild = children.find((c) => c.id === selectedId) ?? children[0] ?? null;

  // Derive school from active child
  const { data: school = null, isLoading: schoolLoading } = useSchool(selectedChild?.school_id);

  return (
    <SelectedChildContext.Provider
      value={{
        selectedChild,
        setSelectedChildId: setSelectedId,
        children,
        isLoading,
        school,
        schoolLoading,
      }}
    >
      {reactChildren}
    </SelectedChildContext.Provider>
  );
}

export function useSelectedChild() {
  return useContext(SelectedChildContext);
}
