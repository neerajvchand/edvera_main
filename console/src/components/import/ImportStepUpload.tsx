import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { UploadCloud, XCircle, Download, Loader2 } from "lucide-react";
import Papa from "papaparse";
import type { ParsedFile } from "@/hooks/useImportFlow";

export function ImportStepUpload({
  onFileReady,
}: {
  onFileReady: (file: ParsedFile) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);

      if (file.size > 10 * 1024 * 1024) {
        setError("File exceeds 10MB limit. Please use a smaller file.");
        return;
      }

      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "csv" && ext !== "tsv") {
        setError("Only .csv and .tsv files are supported.");
        return;
      }

      setParsing(true);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setParsing(false);
          if (!results.meta.fields || results.meta.fields.length === 0) {
            setError("No columns detected. Is the file empty?");
            return;
          }
          onFileReady({
            name: file.name,
            size: file.size,
            headers: results.meta.fields,
            rows: results.data as Record<string, string>[],
          });
        },
        error: (err) => {
          setParsing(false);
          setError(`Parse error: ${err.message}`);
        },
      });
    },
    [onFileReady]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="max-w-xl mx-auto">
      <div
        className={cn(
          "rounded-xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer",
          dragOver
            ? "border-emerald-400 bg-emerald-50"
            : "border-slate-200 bg-white hover:border-slate-300"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        {parsing ? (
          <Loader2 className="h-12 w-12 text-emerald-400 mx-auto animate-spin" />
        ) : (
          <UploadCloud
            className={cn(
              "h-12 w-12 mx-auto",
              dragOver ? "text-emerald-400" : "text-slate-300"
            )}
          />
        )}
        <p className="text-sm text-slate-500 mt-4">
          {parsing
            ? "Parsing file..."
            : "Drag and drop a CSV file here"}
        </p>
        {!parsing && (
          <p className="text-xs text-slate-400 mt-1">or click to browse</p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-100 p-3 flex items-start gap-2">
          <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="mt-6 text-center">
        <a
          href="/edvera-import-template.csv"
          download
          className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
        >
          <Download className="h-3.5 w-3.5" />
          Download template CSV
        </a>
      </div>
    </div>
  );
}
