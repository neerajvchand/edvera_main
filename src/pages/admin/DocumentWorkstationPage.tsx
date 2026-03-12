import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  BookOpen,
  Eye,
  Loader2,
  ShieldAlert,
  Trash2,
  RotateCcw,
  History,
  Shield,
  X,
  ScanLine,
  FileSpreadsheet,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  Mail,
  Clipboard,
  Copy,
  Download,
  TrendingUp,
  Search,
  AlertCircle,
  Target,
  ListChecks,
} from "lucide-react";
import { useCSVAnalysis } from "@/hooks/useCSVAnalysis";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from "recharts";
import {
  useDocuments,
  useDocumentOutput,
  useDocumentChunks,
  useUploadDocument,
  useDeleteDocument,
  useRerunAnalysis,
  useDocAuditEvents,
  type DocType,
  type Audience,
  type Tone,
  type DocumentRow,
} from "@/hooks/useDocumentWorkstation";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";

/* ── Evidence side panel ── */

function EvidencePanel({
  open,
  onClose,
  citation,
  chunks,
  isCSV,
}: {
  open: boolean;
  onClose: () => void;
  citation: any;
  chunks: any[];
  isCSV?: boolean;
}) {
  // For CSV, show column stats
  if (isCSV && citation?.chunk_id === "csv_profile") {
    return (
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Data Reference
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {citation?.column_name && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Column</p>
                <p className="text-sm font-semibold text-foreground">{citation.column_name}</p>
              </div>
            )}
            {citation?.metric && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Metric</p>
                <p className="text-sm font-semibold text-foreground">{citation.metric}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Snippet</p>
              <div className="bg-muted rounded-lg p-4 text-sm text-foreground leading-relaxed border-l-4 border-primary/40">
                {citation?.snippet || "No data reference available"}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const chunkIdx = parseInt((citation?.chunk_id || "").replace("chunk_", ""), 10);
  const chunk = chunks[chunkIdx];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Evidence Detail
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {citation?.page_number && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Page Number</p>
              <p className="text-sm font-semibold text-foreground">Page {citation.page_number}</p>
            </div>
          )}
          {(citation?.section_heading || chunk?.section_heading) && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Section</p>
              <p className="text-sm font-semibold text-foreground">
                {citation?.section_heading || chunk?.section_heading}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chunk ID</p>
            <p className="text-sm font-mono text-foreground">{citation?.chunk_id || "N/A"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Cited Snippet</p>
            <div className="bg-muted rounded-lg p-4 text-sm text-foreground leading-relaxed border-l-4 border-primary/40">
              {chunk?.text || citation?.snippet || "No snippet available"}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ── Processing Timeline Drawer ── */

function ProcessingTimeline({
  open,
  onClose,
  documentId,
}: {
  open: boolean;
  onClose: () => void;
  documentId: string | null;
}) {
  const { data: events } = useDocAuditEvents(documentId);

  const stageIcons: Record<string, { icon: any; color: string }> = {
    start: { icon: Clock, color: "text-primary" },
    detect_file_type: { icon: FileText, color: "text-primary" },
    extract: { icon: FileText, color: "text-primary" },
    extract_text: { icon: FileText, color: "text-primary" },
    parse_csv: { icon: FileSpreadsheet, color: "text-primary" },
    profile_csv: { icon: FileSpreadsheet, color: "text-primary" },
    generate_csv_analysis: { icon: FileSpreadsheet, color: "text-primary" },
    chunk: { icon: BookOpen, color: "text-primary" },
    extract_json: { icon: CheckCircle2, color: "text-primary" },
    extract_actions: { icon: CheckCircle2, color: "text-primary" },
    extract_risks: { icon: ShieldAlert, color: "hsl(var(--status-warning-text))" },
    draft_memo: { icon: FileText, color: "text-primary" },
    generate_memo: { icon: FileText, color: "text-primary" },
    complete: { icon: CheckCircle2, color: "hsl(var(--status-success-text))" },
    fail: { icon: XCircle, color: "text-destructive" },
    failed: { icon: XCircle, color: "text-destructive" },
    error: { icon: XCircle, color: "text-destructive" },
    warning: { icon: ShieldAlert, color: "hsl(var(--status-warning-text))" },
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Processing Timeline
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          {!events || events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No processing events recorded.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
              <div className="space-y-4">
                {events.map((event) => {
                  const config = stageIcons[event.stage] || stageIcons.start;
                  const Icon = config.icon;
                  return (
                    <div key={event.id} className="flex gap-3 relative">
                      <div className="relative z-10 flex items-center justify-center w-6 h-6 rounded-full bg-background border border-border shrink-0">
                        <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0 pb-2">
                        <p className="text-sm font-medium text-foreground capitalize">
                          {event.stage.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{event.message}</p>
                        {event.payload_json?.ocr && (
                          <Badge variant="outline" className="text-[10px] mt-1 gap-0.5 border-[hsl(var(--status-warning-border))] text-[hsl(var(--status-warning-text))]">
                            <ScanLine className="w-2.5 h-2.5" />
                            OCR
                          </Badge>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ── Status badge ── */

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: any; label: string; className: string }> = {
    uploaded: { icon: Clock, label: "Uploaded", className: "bg-secondary text-secondary-foreground" },
    processing: { icon: Loader2, label: "Processing…", className: "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-text))] border-[hsl(var(--status-info-border))]" },
    complete: { icon: CheckCircle2, label: "Complete", className: "bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-text))] border-[hsl(var(--status-success-border))]" },
    failed: { icon: XCircle, label: "Failed", className: "bg-[hsl(var(--status-urgent-bg))] text-[hsl(var(--status-urgent-text))] border-[hsl(var(--status-urgent-border))]" },
  };
  const c = config[status] || config.uploaded;
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={`gap-1 border ${c.className}`}>
      <Icon className={`w-3 h-3 ${status === "processing" ? "animate-spin" : ""}`} />
      {c.label}
    </Badge>
  );
}

/* ── Doc type label ── */

const docTypeLabels: Record<string, string> = {
  board_agenda: "Board Agenda",
  policy_procedure: "Policy",
  vendor_proposal: "Vendor Proposal",
  newsletter_comms: "Newsletter",
  other: "Other",
};

/* ── Helpers ── */

function getFileExt(filename: string): string {
  return filename.toLowerCase().split(".").pop() || "";
}

function isCSVFile(filename: string): boolean {
  return getFileExt(filename) === "csv";
}

function hasOCR(events: any[]): boolean {
  return events?.some((e: any) => e.payload_json?.ocr === true) || false;
}

/* ── Pre-flight Scan Modal ── */

function ScanDetectionModal({
  open,
  onClose,
  onContinue,
}: {
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-[hsl(var(--status-warning-text))]" />
            Scanned Document Detected
          </DialogTitle>
          <DialogDescription>
            This PDF appears to be a scanned document with limited extractable text. OCR (Optical Character Recognition) will be used, which may result in slower processing.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onContinue}>
            <ScanLine className="w-4 h-4 mr-2" />
            Continue with OCR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Upload form ── */

function UploadForm({ onComplete }: { onComplete: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocType>("board_agenda");
  const [audience, setAudience] = useState<Audience>("principal");
  const [tone, setTone] = useState<Tone>("neutral");
  const [strictMode, setStrictMode] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [preflightChecked, setPreflightChecked] = useState(false);

  const upload = useUploadDocument();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) {
      setFile(f);
      setPreflightChecked(false);
    }
  };

  const doPreflightCheck = async (f: File): Promise<boolean> => {
    const ext = f.name.toLowerCase().split(".").pop();
    if (ext !== "pdf") return true; // Only check PDFs

    try {
      // Read first 100KB to check for extractable text
      const slice = f.slice(0, 100 * 1024);
      const text = await slice.text();
      // Count printable text content (excluding PDF binary markers)
      const cleanText = text.replace(/[^\x20-\x7E\n\r]/g, "").trim();
      if (cleanText.length < 500) {
        setShowScanModal(true);
        return false;
      }
    } catch {
      // If we can't read, proceed anyway
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!file) return;

    // Pre-flight check for PDFs
    if (!preflightChecked) {
      const passed = await doPreflightCheck(file);
      if (!passed) return;
    }

    await upload.mutateAsync({ file, docType, audience, tone, strictMode });
    setFile(null);
    setPreflightChecked(false);
    onComplete();
  };

  const handleScanContinue = () => {
    setShowScanModal(false);
    setPreflightChecked(true);
    // Re-trigger submit
    if (file) {
      upload.mutateAsync({ file, docType, audience, tone, strictMode }).then(() => {
        setFile(null);
        setPreflightChecked(false);
        onComplete();
      });
    }
  };

  const handleCancel = () => {
    setFile(null);
    setPreflightChecked(false);
  };

  const progressMap: Record<string, number> = {
    idle: 0,
    uploading: 30,
    creating: 60,
    processing: 90,
  };

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center p-8 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50"
        }`}
        onClick={() => document.getElementById("doc-file-input")?.click()}
      >
        <Upload className="w-8 h-8 text-muted-foreground mb-2" />
        <p className="text-sm font-medium text-foreground">
          {file ? file.name : "Drag & drop PDF, DOCX, or CSV"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Max 20MB, 50 pages. Scanned PDFs supported.
        </p>
        <input
          id="doc-file-input"
          type="file"
          accept=".pdf,.docx,.doc,.csv"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setPreflightChecked(false);
          }}
        />
      </div>

      {file && (
        <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 border border-border">
          <div className="flex items-center gap-2 min-w-0">
            {isCSVFile(file.name) ? (
              <FileSpreadsheet className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-primary shrink-0" />
            )}
            <span className="text-sm text-foreground truncate">{file.name}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {(file.size / 1024).toFixed(0)} KB
            </span>
            {isCSVFile(file.name) && (
              <Badge variant="outline" className="text-[10px]">CSV</Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={handleCancel}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Options grid */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Document Type</label>
          <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="board_agenda">Board Agenda</SelectItem>
              <SelectItem value="policy_procedure">Policy / Procedure</SelectItem>
              <SelectItem value="vendor_proposal">Vendor Proposal</SelectItem>
              <SelectItem value="newsletter_comms">Newsletter / Comms</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Audience</label>
          <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="board">Board</SelectItem>
              <SelectItem value="superintendent">Superintendent</SelectItem>
              <SelectItem value="principal">Principal</SelectItem>
              <SelectItem value="operations">Operations</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Tone</label>
          <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="formal">Formal</SelectItem>
              <SelectItem value="concise">Concise</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Strict mode toggle */}
      <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
        <div>
          <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-primary" />
            Strict Evidence Mode
          </p>
          <p className="text-xs text-muted-foreground">Requires citations for all outputs</p>
        </div>
        <Switch checked={strictMode} onCheckedChange={setStrictMode} />
      </div>

      {/* Upload progress */}
      {upload.uploadProgress !== "idle" && (
        <div className="space-y-2">
          <Progress value={progressMap[upload.uploadProgress] || 0} className="h-2" />
          <p className="text-xs text-muted-foreground text-center capitalize">
            {upload.uploadProgress}… Processing may take up to 30 seconds.
          </p>
        </div>
      )}

      {/* Submit */}
      <Button onClick={handleSubmit} disabled={!file || upload.isPending} className="w-full">
        {upload.isPending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</>
        ) : (
          <><FileText className="w-4 h-4 mr-2" />Analyze Document</>
        )}
      </Button>

      <ScanDetectionModal
        open={showScanModal}
        onClose={() => setShowScanModal(false)}
        onContinue={handleScanContinue}
      />
    </div>
  );
}

/* ── Document History Panel ── */

function DocumentHistoryPanel({
  documents,
  isLoading,
  activeDocId,
  onSelectDoc,
  onDeleteDoc,
  onRerunDoc,
  onViewTimeline,
  auditEventsMap,
}: {
  documents: DocumentRow[];
  isLoading: boolean;
  activeDocId: string | null;
  onSelectDoc: (id: string) => void;
  onDeleteDoc: (doc: DocumentRow) => void;
  onRerunDoc: (docId: string) => void;
  onViewTimeline: (docId: string) => void;
  auditEventsMap: Record<string, any[]>;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!documents.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="w-8 h-8 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No documents analyzed yet.</p>
        <p className="text-xs text-muted-foreground mt-1">Upload a document to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.slice(0, 20).map((doc) => {
        const isCSV = isCSVFile(doc.filename);
        const ocrUsed = hasOCR(auditEventsMap[doc.id] || []);

        return (
          <div
            key={doc.id}
            className={`group rounded-lg border p-3 transition-colors cursor-pointer ${
              activeDocId === doc.id
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/30"
            }`}
            onClick={() => onSelectDoc(doc.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{doc.filename}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <StatusBadge status={doc.status} />
                  <span className="text-[10px] text-muted-foreground">
                    {docTypeLabels[doc.doc_type] || doc.doc_type}
                  </span>
                  {doc.strict_mode && (
                    <Badge variant="outline" className="text-[10px] gap-0.5 border-primary/30 text-primary">
                      <Shield className="w-2.5 h-2.5" />
                      Strict
                    </Badge>
                  )}
                  {isCSV && (
                    <Badge variant="outline" className="text-[10px] gap-0.5">
                      <FileSpreadsheet className="w-2.5 h-2.5" />
                      CSV
                    </Badge>
                  )}
                  {ocrUsed && (
                    <Badge variant="outline" className="text-[10px] gap-0.5 border-[hsl(var(--status-warning-border))] text-[hsl(var(--status-warning-text))]">
                      <ScanLine className="w-2.5 h-2.5" />
                      OCR
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className={`flex items-center gap-1 mt-2 pt-2 border-t border-border ${
              activeDocId === doc.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            } transition-opacity`}>
              {doc.status === "complete" && (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); onSelectDoc(doc.id); }}>
                  <Eye className="w-3 h-3" />View
                </Button>
              )}
              {(doc.status === "complete" || doc.status === "failed") && (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); onRerunDoc(doc.id); }}>
                  <RotateCcw className="w-3 h-3" />Re-run
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); onViewTimeline(doc.id); }}>
                <History className="w-3 h-3" />Timeline
              </Button>
              {doc.status !== "processing" && (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive ml-auto" onClick={(e) => { e.stopPropagation(); onDeleteDoc(doc); }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Delete Confirmation Dialog ── */

function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
  doc,
  isDeleting,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  doc: DocumentRow | null;
  isDeleting: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Document</DialogTitle>
          <DialogDescription>
            This will permanently remove <strong>{doc?.filename}</strong> and all generated outputs. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting…</> : <><Trash2 className="w-4 h-4 mr-2" />Delete</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── CSV Data Preview Tab ── */

function CSVDataPreview({ chunks }: { chunks: any[] }) {
  const csvData = useMemo(() => {
    if (!chunks?.length) return null;
    const firstChunk = chunks[0];
    try {
      return JSON.parse(firstChunk.text);
    } catch {
      return null;
    }
  }, [chunks]);

  if (!csvData) {
    return <p className="text-sm text-muted-foreground text-center py-6">No CSV data available.</p>;
  }

  const { headers, rows, profile } = csvData;

  return (
    <div className="space-y-6">
      {/* Column Summary */}
      {profile && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">Column Summary</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {profile.columns?.slice(0, 10).map((col: any) => (
              <div key={col.name} className="bg-muted/50 rounded-lg p-3 border border-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-foreground truncate">{col.name}</span>
                  <Badge variant="outline" className="text-[10px]">{col.type}</Badge>
                </div>
                {col.type === "numeric" ? (
                  <div className="text-[10px] text-muted-foreground space-y-0.5">
                    <p>Min: {col.min} • Max: {col.max} • Mean: {col.mean}</p>
                    <p>Missing: {col.missing_pct}%</p>
                  </div>
                ) : (
                  <div className="text-[10px] text-muted-foreground space-y-0.5">
                    <p>Unique: {col.unique_count} • Missing: {col.missing_pct}%</p>
                    {col.top_values?.slice(0, 3).map((tv: any) => (
                      <span key={tv.value} className="inline-block mr-2">
                        {tv.value} ({tv.count})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Table */}
      {headers && rows && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">
            Data Preview ({Math.min(rows.length, 50)} of {profile?.row_count ?? rows.length} rows)
          </h4>
          <div className="overflow-auto max-h-[400px] rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.slice(0, 10).map((h: string, i: number) => (
                    <TableHead key={i} className="text-xs whitespace-nowrap">{h}</TableHead>
                  ))}
                  {headers.length > 10 && <TableHead className="text-xs">+{headers.length - 10} more</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 50).map((row: string[], ri: number) => (
                  <TableRow key={ri}>
                    {row.slice(0, 10).map((cell: string, ci: number) => (
                      <TableCell key={ci} className="text-xs py-1.5 whitespace-nowrap max-w-[150px] truncate">
                        {cell}
                      </TableCell>
                    ))}
                    {headers.length > 10 && <TableCell className="text-xs text-muted-foreground">…</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Decision Assistant Tab ── */

function DecisionAssistantTab({ documentId }: { documentId: string }) {
  const { runAction, getResult, isLoading } = useCSVAnalysis(documentId);

  const actions = [
    { key: "outliers", label: "Identify Outliers", icon: Search, desc: "Find statistical anomalies" },
    { key: "compare", label: "Compare Entities", icon: BarChart3, desc: "Compare categories and groups" },
    { key: "risk_indicators", label: "Risk Indicators", icon: AlertCircle, desc: "Flag risk patterns" },
    { key: "data_quality", label: "Data Quality", icon: Shield, desc: "Assess data completeness" },
    { key: "priorities", label: "Suggest Priorities", icon: Target, desc: "Rank operational priorities" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map(({ key, label, icon: Icon, desc }) => (
          <Button
            key={key}
            variant="outline"
            className="h-auto py-3 px-4 flex flex-col items-start gap-1 text-left"
            disabled={isLoading(`decision_assistant_${key}`)}
            onClick={() => runAction("decision_assistant", { sub_action: key })}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              {isLoading(`decision_assistant_${key}`) ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Icon className="w-3.5 h-3.5 text-primary" />
              )}
              {label}
            </span>
            <span className="text-[10px] text-muted-foreground">{desc}</span>
          </Button>
        ))}
      </div>

      {actions.map(({ key }) => {
        const data = getResult(`decision_assistant_${key}`);
        if (!data) return null;
        return (
          <Card key={key}>
            <CardContent className="p-4 space-y-3">
              {data.summary && (
                <p className="text-sm text-foreground font-medium">{data.summary}</p>
              )}
              {data.findings?.map((f: any, i: number) => (
                <div key={i} className="bg-muted/50 rounded-lg p-3 border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className={
                      f.severity === "high" ? "bg-[hsl(var(--status-urgent-bg))] text-[hsl(var(--status-urgent-text))]" :
                      f.severity === "medium" ? "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))]" :
                      "bg-muted text-muted-foreground"
                    }>
                      {f.severity?.toUpperCase()}
                    </Badge>
                    <span className="text-sm font-medium text-foreground">{f.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{f.description}</p>
                  {f.evidence && (
                    <p className="text-[10px] text-primary mt-1.5 font-mono">
                      {f.evidence.column}: {f.evidence.metric} = {f.evidence.value}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ── Board Brief Tab ── */

function BoardBriefTab({ documentId, csvChunks }: { documentId: string; csvChunks: any[] }) {
  const { runAction, getResult, isLoading } = useCSVAnalysis(documentId);
  const data = getResult("board_brief");

  const csvData = useMemo(() => {
    if (!csvChunks?.length) return null;
    try { return JSON.parse(csvChunks[0].text); } catch { return null; }
  }, [csvChunks]);

  const chartData = useMemo(() => {
    if (!data?.chart_suggestion || !csvData) return null;
    const { x_column, y_column } = data.chart_suggestion;
    const xIdx = csvData.headers.indexOf(x_column);
    const yIdx = csvData.headers.indexOf(y_column);
    if (xIdx === -1 || yIdx === -1) return null;
    return csvData.rows.slice(0, 20).map((row: string[]) => ({
      x: row[xIdx],
      y: parseFloat(row[yIdx]) || 0,
    })).filter((d: any) => !isNaN(d.y));
  }, [data, csvData]);

  const copyToClipboard = useCallback(() => {
    if (!data) return;
    const text = [
      "BOARD BRIEF",
      "",
      "EXECUTIVE SUMMARY",
      data.executive_summary,
      "",
      "KEY INSIGHTS",
      ...(data.insights || []).map((i: any, idx: number) => `${idx + 1}. ${i.title}: ${i.detail} [${i.metric_reference}]`),
      "",
      "RISKS",
      ...(data.risks || []).map((r: any, idx: number) => `${idx + 1}. [${r.severity?.toUpperCase()}] ${r.title}: ${r.detail}`),
      "",
      "RECOMMENDATION",
      `${data.recommendation?.title}: ${data.recommendation?.detail}`,
      `Rationale: ${data.recommendation?.rationale}`,
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Board brief copied to clipboard." });
  }, [data]);

  return (
    <div className="space-y-4">
      {!data && (
        <div className="text-center py-6">
          <Button onClick={() => runAction("board_brief")} disabled={isLoading("board_brief")}>
            {isLoading("board_brief") ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</>
            ) : (
              <><Lightbulb className="w-4 h-4 mr-2" />Generate Board Brief</>
            )}
          </Button>
        </div>
      )}

      {data && (
        <>
          <div className="flex items-center gap-2 justify-end">
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={copyToClipboard}>
              <Copy className="w-3 h-3" />Copy
            </Button>
          </div>

          {data.executive_summary && (
            <Card>
              <CardContent className="p-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Executive Summary</h4>
                <p className="text-sm text-foreground leading-relaxed">{data.executive_summary}</p>
              </CardContent>
            </Card>
          )}

          {data.insights?.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Key Insights</h4>
                <div className="space-y-3">
                  {data.insights.map((insight: any, i: number) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{insight.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{insight.detail}</p>
                        <p className="text-[10px] text-primary font-mono mt-1">{insight.metric_reference}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.risks?.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Risks</h4>
                <div className="space-y-2">
                  {data.risks.map((risk: any, i: number) => (
                    <div key={i} className="bg-muted/50 rounded-lg p-3 border border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className={
                          risk.severity === "high" ? "bg-[hsl(var(--status-urgent-bg))] text-[hsl(var(--status-urgent-text))]" :
                          risk.severity === "medium" ? "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))]" :
                          "bg-muted text-muted-foreground"
                        }>{risk.severity?.toUpperCase()}</Badge>
                        <span className="text-sm font-medium text-foreground">{risk.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{risk.detail}</p>
                      <p className="text-[10px] text-primary font-mono mt-1">{risk.metric_reference}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.recommendation && (
            <Card className="border-primary/20">
              <CardContent className="p-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recommendation</h4>
                <p className="text-sm font-medium text-foreground">{data.recommendation.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{data.recommendation.detail}</p>
                <p className="text-[10px] text-muted-foreground mt-1.5 italic">{data.recommendation.rationale}</p>
              </CardContent>
            </Card>
          )}

          {chartData && chartData.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {data.chart_suggestion?.title || "Visualization"}
                </h4>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="x" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                      <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                      <RechartsTooltip />
                      <Bar dataKey="y" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Button variant="outline" size="sm" onClick={() => runAction("board_brief")} disabled={isLoading("board_brief")}>
            <RotateCcw className="w-3 h-3 mr-1" />Regenerate
          </Button>
        </>
      )}
    </div>
  );
}

/* ── Communication Draft Tab ── */

function CommunicationDraftTab({ documentId }: { documentId: string }) {
  const { runAction, getResult, isLoading } = useCSVAnalysis(documentId);
  const [audience, setAudience] = useState("principal");
  const [tone, setTone] = useState("formal");

  const data = getResult("communication_draft");

  const generate = () => {
    runAction("communication_draft", { audience, tone });
  };

  const copyDraft = useCallback(() => {
    if (!data) return;
    navigator.clipboard.writeText(`Subject: ${data.subject}\n\n${data.body}`);
    toast({ title: "Copied", description: "Email draft copied to clipboard." });
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Audience</label>
          <Select value={audience} onValueChange={setAudience}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="principal">Principal</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="district">District</SelectItem>
              <SelectItem value="board">Board</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Tone</label>
          <Select value={tone} onValueChange={setTone}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="formal">Formal</SelectItem>
              <SelectItem value="informational">Informational</SelectItem>
              <SelectItem value="strategic">Strategic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button onClick={generate} disabled={isLoading("communication_draft")} className="w-full h-9">
            {isLoading("communication_draft") ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating…</>
            ) : (
              <><Mail className="w-3.5 h-3.5 mr-1.5" />Generate Draft</>
            )}
          </Button>
        </div>
      </div>

      {data && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Draft</h4>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={copyDraft}>
                <Copy className="w-3 h-3" />Copy
              </Button>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 border border-border">
              <p className="text-xs font-medium text-muted-foreground mb-1">Subject:</p>
              <p className="text-sm font-semibold text-foreground mb-3">{data.subject}</p>
              <Separator className="my-3" />
              <div className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                {data.body}
              </div>
            </div>
            {data.key_data_points?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Data References Used:</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.key_data_points.map((dp: any, i: number) => (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      {dp.column}: {dp.metric} = {dp.value}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── Visualize Tab ── */

function VisualizeTab({ chunks }: { chunks: any[] }) {
  const csvData = useMemo(() => {
    if (!chunks?.length) return null;
    try { return JSON.parse(chunks[0].text); } catch { return null; }
  }, [chunks]);

  const [xCol, setXCol] = useState("");
  const [yCol, setYCol] = useState("");
  const [chartType, setChartType] = useState<"bar" | "scatter" | "distribution">("bar");

  const headers = csvData?.headers || [];
  const profile = csvData?.profile;

  // Auto-select first good columns
  useMemo(() => {
    if (!profile || xCol || yCol) return;
    const cats = profile.columns.filter((c: any) => c.type === "categorical");
    const nums = profile.columns.filter((c: any) => c.type === "numeric");
    if (cats.length > 0) setXCol(cats[0].name);
    if (nums.length > 0) setYCol(nums[0].name);
  }, [profile, xCol, yCol]);

  const chartData = useMemo(() => {
    if (!csvData || !xCol || !yCol) return [];
    const xIdx = headers.indexOf(xCol);
    const yIdx = headers.indexOf(yCol);
    if (xIdx === -1 || yIdx === -1) return [];

    if (chartType === "distribution") {
      // Aggregate by x values
      const agg: Record<string, number[]> = {};
      for (const row of csvData.rows) {
        const key = row[xIdx] || "Unknown";
        if (!agg[key]) agg[key] = [];
        const val = parseFloat(row[yIdx]);
        if (!isNaN(val)) agg[key].push(val);
      }
      return Object.entries(agg).slice(0, 25).map(([key, vals]) => ({
        x: key,
        y: vals.reduce((a, b) => a + b, 0) / vals.length,
        count: vals.length,
      }));
    }

    return csvData.rows.slice(0, 50).map((row: string[]) => ({
      x: row[xIdx] || "",
      y: parseFloat(row[yIdx]) || 0,
    })).filter((d: any) => d.x);
  }, [csvData, xCol, yCol, chartType, headers]);

  const downloadCSV = useCallback(() => {
    if (!chartData.length) return;
    const csv = `${xCol},${yCol}\n${chartData.map((d: any) => `${d.x},${d.y}`).join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chart_data.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [chartData, xCol, yCol]);

  if (!csvData) {
    return <p className="text-sm text-muted-foreground text-center py-6">No CSV data available for visualization.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">X Axis</label>
          <Select value={xCol} onValueChange={setXCol}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Select column" /></SelectTrigger>
            <SelectContent>
              {headers.map((h: string) => (
                <SelectItem key={h} value={h}>{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Y Axis</label>
          <Select value={yCol} onValueChange={setYCol}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Select column" /></SelectTrigger>
            <SelectContent>
              {headers.map((h: string) => (
                <SelectItem key={h} value={h}>{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Chart Type</label>
          <Select value={chartType} onValueChange={(v) => setChartType(v as any)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bar">Bar</SelectItem>
              <SelectItem value="scatter">Scatter</SelectItem>
              <SelectItem value="distribution">Distribution</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {chartData.length > 0 ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {xCol} vs {yCol}
              </h4>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={downloadCSV}>
                <Download className="w-3 h-3" />CSV
              </Button>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "scatter" ? (
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="x" tick={{ fontSize: 10 }} name={xCol} />
                    <YAxis dataKey="y" tick={{ fontSize: 10 }} name={yCol} />
                    <RechartsTooltip />
                    <Scatter data={chartData} fill="hsl(var(--primary))" />
                  </ScatterChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="x" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <RechartsTooltip />
                    <Bar dataKey="y" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">Select columns to visualize.</p>
      )}
    </div>
  );
}

/* ── Results view ── */

function DocumentResults({ doc, auditEvents }: { doc: DocumentRow; auditEvents: any[] }) {
  const { data: output } = useDocumentOutput(doc.id);
  const { data: chunks } = useDocumentChunks(doc.id);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<any>(null);

  const isCSV = isCSVFile(doc.filename);
  const ocrUsed = hasOCR(auditEvents);
  const piiDetected = auditEvents?.some((e: any) => e.payload_json?.pii_detected === true);

  const openEvidence = (citation: any) => {
    setSelectedCitation(citation);
    setEvidenceOpen(true);
  };

  if (doc.status === "processing") {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Analyzing document…</p>
          <p className="text-xs text-muted-foreground mt-1">Processing may take up to 30 seconds.</p>
        </CardContent>
      </Card>
    );
  }

  if (doc.status === "failed") {
    return (
      <Card className="border-destructive/30">
        <CardContent className="py-8 text-center">
          <XCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
          <p className="text-sm font-medium text-destructive">Processing failed</p>
          <p className="text-xs text-muted-foreground mt-1">Use the Re-run button in the history panel to retry.</p>
        </CardContent>
      </Card>
    );
  }

  if (!output) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Clock className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Waiting for results…</p>
        </CardContent>
      </Card>
    );
  }

  const actionItems = output.action_items_json || [];
  const risks = output.risks_json || [];
  const citations = output.citations_json || [];

  // CSV gets 9 tabs, PDF/DOCX gets 4
  const csvTabs = isCSV ? ["decision", "brief", "comms", "visualize", "data"] : [];

  return (
    <>
      {/* PII warning banner */}
      {piiDetected && (
        <div className="flex items-start gap-2 bg-[hsl(var(--status-warning-bg))] rounded-lg px-4 py-3 border border-[hsl(var(--status-warning-border))] mb-4">
          <AlertTriangle className="w-4 h-4 text-[hsl(var(--status-warning-text))] mt-0.5 shrink-0" />
          <p className="text-xs text-[hsl(var(--status-warning-text))] leading-relaxed">
            <strong>Warning:</strong> Potential sensitive student information detected. Review before sharing.
          </p>
        </div>
      )}

      {/* Document metadata header */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <h3 className="text-sm font-semibold text-foreground truncate max-w-[200px]">{doc.filename}</h3>
        <StatusBadge status={doc.status} />
        {doc.strict_mode && (
          <Badge variant="outline" className="text-[10px] gap-0.5 border-primary/30 text-primary">
            <Shield className="w-2.5 h-2.5" />Strict Evidence
          </Badge>
        )}
        {ocrUsed && (
          <Badge variant="outline" className="text-[10px] gap-0.5 border-[hsl(var(--status-warning-border))] text-[hsl(var(--status-warning-text))]">
            <ScanLine className="w-2.5 h-2.5" />OCR Used
          </Badge>
        )}
        {isCSV && (
          <Badge variant="outline" className="text-[10px] gap-0.5">
            <FileSpreadsheet className="w-2.5 h-2.5" />CSV
          </Badge>
        )}
        <span className="text-[10px] text-muted-foreground">
          {docTypeLabels[doc.doc_type] || doc.doc_type} • {doc.audience} • {doc.tone}
        </span>
      </div>

      <Tabs defaultValue="actions" className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="actions" className="text-xs">Actions ({actionItems.length})</TabsTrigger>
          <TabsTrigger value="memo" className="text-xs">Memo</TabsTrigger>
          <TabsTrigger value="risks" className="text-xs">Risks ({risks.length})</TabsTrigger>
          <TabsTrigger value="evidence" className="text-xs">Evidence</TabsTrigger>
          {isCSV && <TabsTrigger value="decision" className="text-xs"><Lightbulb className="w-3 h-3 mr-1" />Decisions</TabsTrigger>}
          {isCSV && <TabsTrigger value="brief" className="text-xs"><ListChecks className="w-3 h-3 mr-1" />Board Brief</TabsTrigger>}
          {isCSV && <TabsTrigger value="comms" className="text-xs"><Mail className="w-3 h-3 mr-1" />Comms</TabsTrigger>}
          {isCSV && <TabsTrigger value="visualize" className="text-xs"><BarChart3 className="w-3 h-3 mr-1" />Visualize</TabsTrigger>}
          {isCSV && <TabsTrigger value="data" className="text-xs">Data</TabsTrigger>}
        </TabsList>

        {/* Action Items Tab */}
        <TabsContent value="actions" className="mt-4">
          {actionItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No action items extracted from this document.</p>
          ) : (
            <div className="space-y-3">
              {actionItems.map((item: any, i: number) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                          {item.owner && <span>Owner: {item.owner}</span>}
                          {item.due_date && <span>Due: {item.due_date}</span>}
                        </div>
                        {item.supporting_quote && (
                          <p className="text-xs text-muted-foreground mt-2 italic border-l-2 border-muted-foreground/20 pl-2">
                            "{item.supporting_quote.substring(0, 150)}{item.supporting_quote.length > 150 ? "…" : ""}"
                          </p>
                        )}
                      </div>
                      {item.citations?.length > 0 && (
                        <Button variant="ghost" size="sm" className="shrink-0 text-xs gap-1" onClick={() => openEvidence(item.citations[0])}>
                          <Eye className="w-3.5 h-3.5" />View
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Memo Tab */}
        <TabsContent value="memo" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="prose prose-sm max-w-none text-foreground">
                {output.memo_text.split("\n").map((line, i) => {
                  if (line.startsWith("**") && line.endsWith("**")) {
                    return <h3 key={i} className="font-semibold text-base mt-4 mb-2 text-foreground">{line.replace(/\*\*/g, "")}</h3>;
                  }
                  if (line.startsWith("- ") || line.startsWith("• ")) {
                    return <li key={i} className="text-sm text-foreground ml-4">{line.replace(/^[-•]\s*/, "")}</li>;
                  }
                  if (line.trim() === "") return <br key={i} />;
                  return <p key={i} className="text-sm text-foreground">{line}</p>;
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risks Tab */}
        <TabsContent value="risks" className="mt-4">
          {risks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No risks or requirements extracted.</p>
          ) : (
            <div className="space-y-3">
              {risks.map((risk: any, i: number) => {
                const severityColors: Record<string, string> = {
                  high: "bg-[hsl(var(--status-urgent-bg))] text-[hsl(var(--status-urgent-text))]",
                  medium: "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))]",
                  med: "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))]",
                  low: "bg-muted text-muted-foreground",
                };
                return (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className={severityColors[risk.severity] || severityColors.low}>
                              {risk.severity?.toUpperCase()}
                            </Badge>
                            <span className="text-xs text-muted-foreground capitalize">{risk.risk_type}</span>
                          </div>
                          <p className="text-sm font-medium text-foreground">{risk.description}</p>
                          {risk.requirement_or_clause && (
                            <p className="text-xs text-muted-foreground mt-1.5 italic border-l-2 border-muted-foreground/20 pl-2">
                              "{risk.requirement_or_clause.substring(0, 150)}{risk.requirement_or_clause.length > 150 ? "…" : ""}"
                            </p>
                          )}
                        </div>
                        {risk.citations?.length > 0 && (
                          <Button variant="ghost" size="sm" className="shrink-0 text-xs gap-1" onClick={() => openEvidence(risk.citations[0])}>
                            <Eye className="w-3.5 h-3.5" />View
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Evidence Tab */}
        <TabsContent value="evidence" className="mt-4">
          {citations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No citations recorded.</p>
          ) : (
            <div className="space-y-2">
              {citations.map((cit: any, i: number) => (
                <Card key={i} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openEvidence(cit)}>
                  <CardContent className="p-3 flex items-start gap-3">
                    {isCSV ? <FileSpreadsheet className="w-4 h-4 text-primary mt-0.5 shrink-0" /> : <BookOpen className="w-4 h-4 text-primary mt-0.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <span className="font-mono">{cit.chunk_id}</span>
                        {cit.page_number && <span>• Page {cit.page_number}</span>}
                        {cit.section_heading && <span>• {cit.section_heading}</span>}
                        <Badge variant="outline" className="text-[10px] ml-auto">{cit.source}</Badge>
                      </div>
                      <p className="text-sm text-foreground line-clamp-2">{cit.snippet}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* CSV-only tabs */}
        {isCSV && (
          <>
            <TabsContent value="decision" className="mt-4">
              <DecisionAssistantTab documentId={doc.id} />
            </TabsContent>
            <TabsContent value="brief" className="mt-4">
              <BoardBriefTab documentId={doc.id} csvChunks={chunks || []} />
            </TabsContent>
            <TabsContent value="comms" className="mt-4">
              <CommunicationDraftTab documentId={doc.id} />
            </TabsContent>
            <TabsContent value="visualize" className="mt-4">
              <VisualizeTab chunks={chunks || []} />
            </TabsContent>
            <TabsContent value="data" className="mt-4">
              <CSVDataPreview chunks={chunks || []} />
            </TabsContent>
          </>
        )}
      </Tabs>

      <EvidencePanel
        open={evidenceOpen}
        onClose={() => setEvidenceOpen(false)}
        citation={selectedCitation}
        chunks={chunks || []}
        isCSV={isCSV}
      />
    </>
  );
}

/* ── Main Page ── */

export default function DocumentWorkstationPage() {
  const { data: documents, isLoading } = useDocuments();
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentRow | null>(null);
  const [timelineDocId, setTimelineDocId] = useState<string | null>(null);

  const deleteMutation = useDeleteDocument();
  const rerunMutation = useRerunAnalysis();

  // Fetch audit events for all visible documents to detect OCR usage
  const docIds = documents?.slice(0, 20).map((d) => d.id) || [];
  const auditQueries: Record<string, any[]> = {};
  // We'll use the complete events from the active doc
  const { data: activeAuditEvents } = useDocAuditEvents(activeDocId);

  // Build a simple map for the history panel
  const auditEventsMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    if (activeDocId && activeAuditEvents) {
      map[activeDocId] = activeAuditEvents;
    }
    return map;
  }, [activeDocId, activeAuditEvents]);

  const activeDoc = documents?.find((d) => d.id === activeDocId);

  // Auto-select latest completed document
  if (!activeDocId && documents?.length) {
    const latest = documents[0];
    if (latest.status === "complete" || latest.status === "processing") {
      setActiveDocId(latest.id);
    }
  }

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => {
        if (activeDocId === deleteTarget.id) setActiveDocId(null);
        setDeleteTarget(null);
      },
    });
  };

  const handleRerun = (docId: string) => {
    rerunMutation.mutate(docId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" />
          Document Workstation
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload and analyze documents — extract action items, generate memos, and identify risks with citations.
        </p>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 bg-muted/60 rounded-lg px-4 py-3 border border-border">
        <ShieldAlert className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong>Note:</strong> Outputs are AI-generated from uploaded documents. Review before sharing. No student-level data is processed. Scanned PDFs supported via OCR.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: Upload + Results */}
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary" />
                Upload Document
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UploadForm onComplete={() => setActiveDocId(null)} />
            </CardContent>
          </Card>

          {activeDoc && (
            <div>
              <Separator className="mb-6" />
              <DocumentResults doc={activeDoc} auditEvents={activeAuditEvents || []} />
            </div>
          )}

          {!activeDoc && documents && documents.length > 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <Eye className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Select a document from the history panel to view results.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT: Document History */}
        <div className="lg:col-span-5">
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                Document History
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[calc(100vh-16rem)] overflow-y-auto">
              <DocumentHistoryPanel
                documents={documents ?? []}
                isLoading={isLoading}
                activeDocId={activeDocId}
                onSelectDoc={setActiveDocId}
                onDeleteDoc={setDeleteTarget}
                onRerunDoc={handleRerun}
                onViewTimeline={setTimelineDocId}
                auditEventsMap={auditEventsMap}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        doc={deleteTarget}
        isDeleting={deleteMutation.isPending}
      />

      <ProcessingTimeline
        open={!!timelineDocId}
        onClose={() => setTimelineDocId(null)}
        documentId={timelineDocId}
      />
    </div>
  );
}
