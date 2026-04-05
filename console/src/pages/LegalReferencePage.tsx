import { useState, useMemo, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Search,
  Info,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Tag,
  Scale,
} from "lucide-react";
import {
  EC_SECTIONS,
  FILTER_CATEGORIES,
  type ECSection,
} from "@/data/educationCodeSections";
import { CARD, PAGE_TITLE, CASE_DETAIL, CONTENT_PADDING } from "@/lib/designTokens";

/* ------------------------------------------------------------------ */
/* Disclaimer Banner                                                   */
/* ------------------------------------------------------------------ */

function DisclaimerBanner() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-4 mb-6">
      <div className="flex items-start gap-3">
        <Info className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-[13px] font-medium text-amber-800">
            Legal Reference Only
          </p>
          <p className="text-[13px] text-amber-700 mt-1">
            This page provides Education Code text for reference purposes only.
            Statutes are current as of each section's noted effective date. This
            is not legal advice. Always consult the{" "}
            <a
              href="https://leginfo.legislature.ca.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium hover:text-amber-900"
            >
              official California Legislative Information site
            </a>{" "}
            or qualified legal counsel for authoritative guidance.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Search Bar                                                          */
/* ------------------------------------------------------------------ */

function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by section number, title, or keyword…"
        className="w-full pl-10 pr-4 py-2.5 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Filter Pills                                                        */
/* ------------------------------------------------------------------ */

function FilterPills({
  active,
  onChange,
}: {
  active: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTER_CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onChange(cat.value)}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
            active === cat.value
              ? "bg-blue-50 text-blue-800 font-semibold"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Highlight helper                                                    */
/* ------------------------------------------------------------------ */

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  // Escape regex special characters
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Section Card                                                        */
/* ------------------------------------------------------------------ */

function SectionCard({
  section,
  isExpanded,
  onToggle,
  searchQuery,
}: {
  section: ECSection;
  isExpanded: boolean;
  onToggle: () => void;
  searchQuery: string;
}) {
  return (
    <div
      id={`section-${section.section}`}
      className={`${CARD} overflow-hidden`}
    >
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-start gap-3 hover:bg-gray-50 transition-colors"
      >
        <div className="shrink-0 mt-1">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[13px] font-semibold text-brand-500">
              {section.citation}
            </span>
            <span className="text-xs text-gray-400">
              {section.effectiveDate}
            </span>
          </div>
          <h3 className="text-[13px] font-semibold text-gray-900 mb-1">
            {highlightMatch(section.title, searchQuery)}
          </h3>
          <p className={`${CASE_DETAIL} leading-relaxed`}>
            {highlightMatch(section.summary, searchQuery)}
          </p>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {/* Full text */}
          <div className="px-5 py-4 bg-gray-50">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Full Statutory Text
            </h4>
            <div className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap font-mono bg-white rounded-lg border border-gray-200 p-4 max-h-96 overflow-y-auto">
              {section.fullText}
            </div>
          </div>

          {/* Meta footer */}
          <div className="px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            {/* Used in */}
            {section.usedIn.length > 0 && (
              <div className="flex items-center gap-2">
                <Tag className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-xs text-gray-400">Used in:</span>
                <div className="flex flex-wrap gap-1">
                  {section.usedIn.map((u) => (
                    <span
                      key={u}
                      className="text-[10px] font-medium bg-blue-50 text-blue-800 px-2 py-0.5 rounded-full"
                    >
                      {u}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Related sections */}
            {section.relatedSections.length > 0 && (
              <div className="flex items-center gap-2">
                <Scale className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-xs text-gray-400">Related:</span>
                <div className="flex flex-wrap gap-1">
                  {section.relatedSections.map((s) => (
                    <a
                      key={s}
                      href={`#section-${s}`}
                      className="text-[10px] font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors"
                    >
                      §{s}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Legislature link */}
            <a
              href={`https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=${section.section}.&lawCode=EDC`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors ml-auto"
            >
              View on CA Legislature
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Category → tag mapping for filter                                   */
/* ------------------------------------------------------------------ */

const CATEGORY_TAG_MAP: Record<string, string[]> = {
  truancy: ["truancy", "tier1", "tier2", "notification", "letter"],
  "chronic-absence": [
    "chronic-absence",
    "excused-absence",
    "classification",
  ],
  sarb: ["sarb", "tier3", "referral"],
  penalties: ["penalties", "penal-code", "parent-liability"],
  records: ["records", "privacy"],
};

/* ------------------------------------------------------------------ */
/* Main Page                                                           */
/* ------------------------------------------------------------------ */

export function LegalReferencePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );
  const location = useLocation();

  // Auto-expand and scroll to section if hash is present
  useEffect(() => {
    const hash = location.hash;
    if (hash && hash.startsWith("#section-")) {
      const sectionNum = hash.replace("#section-", "");
      setExpandedSections((prev) => new Set(prev).add(sectionNum));

      // Small delay to allow render, then scroll
      requestAnimationFrame(() => {
        const el = document.getElementById(hash.slice(1));
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }
  }, [location.hash]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Filter + search
  const filteredSections = useMemo(() => {
    let result: ECSection[] = EC_SECTIONS;

    // Category filter
    if (activeFilter !== "all") {
      const tags = CATEGORY_TAG_MAP[activeFilter] ?? [];
      result = result.filter((s) => s.tags.some((t) => tags.includes(t)));
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.section.includes(q) ||
          s.citation.toLowerCase().includes(q) ||
          s.title.toLowerCase().includes(q) ||
          s.summary.toLowerCase().includes(q) ||
          s.fullText.toLowerCase().includes(q)
      );
    }

    return result;
  }, [activeFilter, searchQuery]);

  return (
    <div className={`max-w-4xl mx-auto ${CONTENT_PADDING}`}>
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
          <Link to="/compliance" className="hover:text-gray-600 transition-colors">
            Compliance
          </Link>
          <span>/</span>
          <span className="text-gray-600">Legal Reference</span>
        </div>
        <h1 className={`${PAGE_TITLE} mb-1`}>
          Education Code Reference
        </h1>
        <p className={CASE_DETAIL}>
          California Education Code sections relevant to attendance, truancy,
          and SARB compliance.
        </p>
      </div>

      <DisclaimerBanner />

      {/* Search + filters */}
      <div className="space-y-3 mb-6">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        <FilterPills active={activeFilter} onChange={setActiveFilter} />
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-400">
          {filteredSections.length} of {EC_SECTIONS.length} sections
        </p>
        {(searchQuery || activeFilter !== "all") && (
          <button
            onClick={() => {
              setSearchQuery("");
              setActiveFilter("all");
            }}
            className="text-xs text-brand-500 hover:text-brand-600 font-medium transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Section cards */}
      <div className="space-y-3">
        {filteredSections.map((section) => (
          <SectionCard
            key={section.section}
            section={section}
            isExpanded={expandedSections.has(section.section)}
            onToggle={() => toggleSection(section.section)}
            searchQuery={searchQuery}
          />
        ))}

        {filteredSections.length === 0 && (
          <div className="text-center py-16">
            <Search className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-[13px] font-medium text-gray-500">
              No sections match your search
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Try a different search term or clear the filters
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
