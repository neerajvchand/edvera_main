import { useState } from "react";
import { Landmark, ExternalLink, PenLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSelectedChild } from "@/hooks/useSelectedChild";
import { useLatestBoardBrief } from "@/hooks/useBoardBriefs";
import { useIsDistrictAdmin } from "@/hooks/useDistrictAdmin";
import { format, parseISO } from "date-fns";
import { BoardBriefEditorModal } from "@/components/modals/BoardBriefEditorModal";

export function BoardBriefsCard() {
  const { selectedChild, school } = useSelectedChild();
  const [showEditor, setShowEditor] = useState(false);

  const districtId =
    (selectedChild as any)?.district_id ??
    (school as any)?.district_id ??
    null;

  const { data: brief, isLoading } = useLatestBoardBrief(districtId);
  const { data: isAdmin } = useIsDistrictAdmin(districtId);

  if (!districtId) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-0.5">District Governance</p>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Landmark className="w-4 h-4 text-primary" />
            Board Briefs
            {isAdmin && (
              <button
                onClick={() => setShowEditor(true)}
                className="ml-auto text-muted-foreground hover:text-primary transition-colors"
                aria-label={brief ? "Edit Brief" : "Publish Brief"}
                title={brief ? "Edit Brief" : "Publish Brief"}
              >
                <PenLine className="w-4 h-4" />
                <span className="text-xs ml-0.5">{brief ? "Edit" : "Publish"}</span>
              </button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground animate-pulse">
              Loading…
            </p>
          ) : !brief ? (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Board meetings are monitored for this district. A summary will appear after the next published meeting.
              </p>
              <p className="text-xs text-muted-foreground/70">
                We surface parent-relevant highlights from publicly available agendas and minutes.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="text-sm font-medium text-foreground leading-snug">
                  {brief.title}
                </h4>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(parseISO(brief.meeting_date), "MMM d, yyyy")}
                </span>
              </div>

              {(brief as any).impact_summary && (
                <p className="text-sm leading-snug">
                  <span className="font-semibold text-foreground">Why this matters: </span>
                  <span className="text-muted-foreground">{(brief as any).impact_summary}</span>
                </p>
              )}

              {brief.summary_short && (
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                  {brief.summary_short}
                </p>
              )}

              {brief.key_topics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {brief.key_topics.map((topic, i) => (
                    <span
                      key={i}
                      className="inline-block text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              )}

              {brief.source_url && (
                <a
                  href={brief.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline pt-1"
                >
                  Read source
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {showEditor && (
        <BoardBriefEditorModal
          districtId={districtId}
          existing={brief}
          onClose={() => setShowEditor(false)}
        />
      )}
    </>
  );
}
