import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { useBoardMeetingMutation, BoardMeetingInput } from "@/hooks/useBoardMeetingMutation";
import { BoardMeeting } from "@/hooks/useBoardBriefs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Props {
  districtId: string;
  existing?: BoardMeeting | null;
  onClose: () => void;
}

export function BoardBriefEditorModal({ districtId, existing, onClose }: Props) {
  const { toast } = useToast();
  const mutation = useBoardMeetingMutation(districtId);
  const ex = existing as any;

  const [meetingDate, setMeetingDate] = useState(
    existing?.meeting_date ?? format(new Date(), "yyyy-MM-dd")
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  const [sourceUrl, setSourceUrl] = useState(existing?.source_url ?? "");
  const [summaryShort, setSummaryShort] = useState(existing?.summary_short ?? "");
  const [keyTopics, setKeyTopics] = useState(
    existing?.key_topics?.join(", ") ?? ""
  );
  const [status, setStatus] = useState<string>(ex?.status ?? "brief_pending");

  // Impact fields
  const [relevanceScore, setRelevanceScore] = useState<number>(
    ex?.relevance_score ?? 0.3
  );
  const [impactSummary, setImpactSummary] = useState(ex?.impact_summary ?? "");
  const [affectsSafety, setAffectsSafety] = useState<boolean>(ex?.affects_safety ?? false);
  const [affectsSchedule, setAffectsSchedule] = useState<boolean>(ex?.affects_schedule ?? false);
  const [affectsStudents, setAffectsStudents] = useState<boolean>(ex?.affects_students ?? false);
  const [affectsPolicy, setAffectsPolicy] = useState<boolean>(ex?.affects_policy ?? false);

  const handleSubmit = async (e: React.FormEvent, publish = false) => {
    e.preventDefault();

    const input: BoardMeetingInput = {
      id: existing?.id,
      district_id: districtId,
      meeting_date: meetingDate,
      title: title.trim(),
      source_url: sourceUrl.trim() || null,
      summary_short: summaryShort.trim(),
      key_topics: keyTopics
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      status: publish ? "published" : status,
      relevance_score: relevanceScore,
      impact_summary: impactSummary.trim() || null,
      affects_safety: affectsSafety,
      affects_schedule: affectsSchedule,
      affects_students: affectsStudents,
      affects_policy: affectsPolicy,
    };

    try {
      await mutation.mutateAsync(input);
      toast({ title: publish ? "Brief published" : "Board brief saved", duration: 2000 });
      onClose();
    } catch (err: any) {
      toast({
        title: "Error saving brief",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-base font-semibold">
            {existing ? "Edit Board Brief" : "Add Board Brief"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => handleSubmit(e)} className="p-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="meeting_date">Meeting Date *</Label>
            <Input
              id="meeting_date"
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Regular Board Meeting"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="source_url">Source URL</Label>
            <Input
              id="source_url"
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="summary_short">Summary * (markdown allowed)</Label>
            <Textarea
              id="summary_short"
              value={summaryShort}
              onChange={(e) => setSummaryShort(e.target.value)}
              placeholder="Parent-friendly bullet summary..."
              rows={4}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="key_topics">Key Topics (comma-separated)</Label>
            <Input
              id="key_topics"
              value={keyTopics}
              onChange={(e) => setKeyTopics(e.target.value)}
              placeholder="budget, safety, curriculum"
            />
          </div>

          {/* Impact Section */}
          <div className="border-t pt-3 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Impact</h3>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Relevance Score: <span className="font-mono">{relevanceScore.toFixed(1)}</span>
              </Label>
              <Slider
                value={[relevanceScore]}
                onValueChange={([v]) => setRelevanceScore(Math.round(v * 10) / 10)}
                min={0}
                max={1}
                step={0.1}
                className="w-full"
              />
              <p className="text-[11px] text-muted-foreground">
                ≥ 0.8 triggers parent alerts automatically
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "affects_safety", label: "Affects Safety", value: affectsSafety, set: setAffectsSafety },
                { id: "affects_schedule", label: "Affects Schedule", value: affectsSchedule, set: setAffectsSchedule },
                { id: "affects_students", label: "Affects Students", value: affectsStudents, set: setAffectsStudents },
                { id: "affects_policy", label: "Affects Policy", value: affectsPolicy, set: setAffectsPolicy },
              ].map((item) => (
                <label
                  key={item.id}
                  htmlFor={item.id}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    id={item.id}
                    checked={item.value}
                    onCheckedChange={(v) => item.set(v === true)}
                  />
                  {item.label}
                </label>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="impact_summary" className="text-xs">
                Impact Summary <span className="text-muted-foreground">(~200 chars)</span>
              </Label>
              <Textarea
                id="impact_summary"
                value={impactSummary}
                onChange={(e) => setImpactSummary(e.target.value)}
                placeholder="1–2 sentences on why this matters to parents..."
                rows={2}
                maxLength={250}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="brief_pending">Brief Pending</option>
              <option value="published">Published</option>
              <option value="detected">Detected</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={(e) => handleSubmit(e as any)}
            >
              {mutation.isPending ? "Saving…" : "Save Draft"}
            </Button>
            <Button
              type="button"
              disabled={mutation.isPending}
              onClick={(e) => handleSubmit(e as any, true)}
            >
              {mutation.isPending ? "Publishing…" : "Publish"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}