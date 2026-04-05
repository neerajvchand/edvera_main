import { useImportFlow } from "@/hooks/useImportFlow";
import { ImportProgressBar } from "@/components/import/ImportProgressBar";
import { ImportStepUpload } from "@/components/import/ImportStepUpload";
import { ImportStepMapping } from "@/components/import/ImportStepMapping";
import { ImportStepValidation } from "@/components/import/ImportStepValidation";
import { ImportStepComplete } from "@/components/import/ImportStepComplete";
import { PAGE_TITLE, CASE_DETAIL, CONTENT_PADDING } from "@/lib/designTokens";

/* ================================================================== */
/* Import Page — Thin orchestration shell                              */
/* ================================================================== */

export function ImportPage() {
  const flow = useImportFlow();

  return (
    <div className={`${CONTENT_PADDING} max-w-5xl`}>
      {/* Header */}
      <div className="mb-6">
        <h1 className={PAGE_TITLE}>Import Data</h1>
        <p className={`${CASE_DETAIL} mt-0.5`}>
          Upload attendance data from your SIS export
        </p>
      </div>

      {/* Step indicator */}
      <ImportProgressBar
        currentStep={flow.step}
        completedSteps={flow.completedSteps}
      />

      {/* Step content */}
      {flow.step === "upload" && (
        <ImportStepUpload onFileReady={flow.handleFileReady} />
      )}

      {flow.step === "map" && flow.parsed && (
        <ImportStepMapping
          parsed={flow.parsed}
          mapping={flow.mapping}
          onMappingChange={flow.setMapping}
          onContinue={flow.handleMappingContinue}
          onBack={flow.goBackToUpload}
        />
      )}

      {flow.step === "validate" && (
        <ImportStepValidation
          validatedRows={flow.validatedRows}
          isAbsenceOnly={flow.isAbsenceOnly}
          normSummary={flow.normSummary}
          onImport={flow.handleImport}
          onBack={flow.goBackToMap}
        />
      )}

      {flow.step === "import" && (
        <ImportStepComplete
          summary={flow.summary}
          importPhase={flow.importPhase}
          importProgress={flow.importProgress}
          engineProgress={flow.engineProgress}
        />
      )}
    </div>
  );
}
