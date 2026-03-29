import { Loader2, Sparkles } from "lucide-react";

export function SarbPacketStepNarrative({
  narrative,
  setNarrative,
  generating,
  onGenerate,
}: {
  narrative: string;
  setNarrative: (v: string) => void;
  generating: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Generate an AI-drafted narrative summary or write your own. This will be included in the SARB packet
        as the case overview.
      </p>

      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-gray-500">
          Narrative Summary <span className="text-red-500">*</span>
        </label>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {generating ? "Generating..." : narrative ? "Regenerate with AI" : "Generate with AI"}
        </button>
      </div>

      <textarea
        value={narrative}
        onChange={(e) => setNarrative(e.target.value)}
        rows={12}
        placeholder="Enter the SARB narrative summary... This should describe the student's attendance history, interventions attempted, and reason for SARB referral."
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none font-mono leading-relaxed"
      />

      <p className="text-xs text-gray-400">
        {narrative.length > 0 ? `${narrative.split(/\s+/).filter(Boolean).length} words` : "No content yet"}
        {" \u00b7 "}The narrative should reference applicable Education Code sections (EC \u00a748260, \u00a748262, \u00a748263).
      </p>
    </div>
  );
}
