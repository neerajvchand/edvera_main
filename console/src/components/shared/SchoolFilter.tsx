import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface SchoolOption {
  id: string;
  name: string;
}

interface SchoolFilterProps {
  value: string | undefined;
  onChange: (schoolId: string | undefined) => void;
  /** Optionally pass pre-fetched schools to avoid extra DB call */
  schools?: SchoolOption[];
}

/**
 * Reusable school filter dropdown. Fetches the school list on mount
 * unless pre-fetched schools are provided.
 */
export function SchoolFilter({ value, onChange, schools: propSchools }: SchoolFilterProps) {
  const [schools, setSchools] = useState<SchoolOption[]>(propSchools ?? []);

  useEffect(() => {
    if (propSchools) {
      setSchools(propSchools);
      return;
    }
    supabase
      .from("schools")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data) setSchools(data as SchoolOption[]);
      });
  }, [propSchools]);

  return (
    <div className="relative">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="appearance-none bg-gray-100 text-xs font-medium text-gray-600 rounded-full pl-3 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer hover:bg-gray-200 transition-colors"
      >
        <option value="">All Schools</option>
        {schools.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
    </div>
  );
}
