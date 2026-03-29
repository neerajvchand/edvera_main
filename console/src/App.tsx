import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthGate } from "@/components/AuthGate";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { PageErrorBoundary } from "@/components/shared/PageErrorBoundary";

/* Auth-critical pages — loaded eagerly (no lazy) */
import { LoginPage } from "@/pages/LoginPage";
import { SecurityPage } from "@/pages/SecurityPage";

/* Route-level code-split pages */
const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const StudentsPage = lazy(() =>
  import("@/pages/StudentsPage").then((m) => ({ default: m.StudentsPage }))
);
const StudentDetailPage = lazy(() =>
  import("@/pages/StudentDetailPage").then((m) => ({
    default: m.StudentDetailPage,
  }))
);
const CompliancePage = lazy(() =>
  import("@/pages/CompliancePage").then((m) => ({ default: m.CompliancePage }))
);
const CaseWorkspacePage = lazy(() =>
  import("@/pages/compliance/CaseWorkspacePage").then((m) => ({
    default: m.CaseWorkspacePage,
  }))
);
const FundingPage = lazy(() =>
  import("@/pages/FundingPage").then((m) => ({ default: m.FundingPage }))
);
const ActionCenterPage = lazy(() =>
  import("@/pages/ActionCenterPage").then((m) => ({
    default: m.ActionCenterPage,
  }))
);
const ImportPage = lazy(() =>
  import("@/pages/ImportPage").then((m) => ({ default: m.ImportPage }))
);
const ReportsPage = lazy(() =>
  import("@/pages/ReportsPage").then((m) => ({ default: m.ReportsPage }))
);
const LegalReferencePage = lazy(() =>
  import("@/pages/LegalReferencePage").then((m) => ({
    default: m.LegalReferencePage,
  }))
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);

/* Shared page-loading spinner shown while lazy chunks load */
function PageLoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/security" element={<SecurityPage />} />

        <Route element={<AuthGate />}>
          <Route element={<ConsoleLayout />}>
            <Route
              path="/dashboard"
              element={
                <PageErrorBoundary>
                  <Suspense fallback={<PageLoadingSpinner />}>
                    <DashboardPage />
                  </Suspense>
                </PageErrorBoundary>
              }
            />
            <Route
              path="/students"
              element={
                <PageErrorBoundary>
                  <Suspense fallback={<PageLoadingSpinner />}>
                    <StudentsPage />
                  </Suspense>
                </PageErrorBoundary>
              }
            />
            <Route
              path="/student/:id"
              element={
                <PageErrorBoundary>
                  <Suspense fallback={<PageLoadingSpinner />}>
                    <StudentDetailPage />
                  </Suspense>
                </PageErrorBoundary>
              }
            />
            <Route
              path="/compliance"
              element={
                <PageErrorBoundary>
                  <Suspense fallback={<PageLoadingSpinner />}>
                    <CompliancePage />
                  </Suspense>
                </PageErrorBoundary>
              }
            />
            <Route
              path="/compliance/cases/:caseId"
              element={
                <PageErrorBoundary>
                  <Suspense fallback={<PageLoadingSpinner />}>
                    <CaseWorkspacePage />
                  </Suspense>
                </PageErrorBoundary>
              }
            />
            <Route
              path="/actions"
              element={
                <PageErrorBoundary>
                  <Suspense fallback={<PageLoadingSpinner />}>
                    <ActionCenterPage />
                  </Suspense>
                </PageErrorBoundary>
              }
            />
            <Route
              path="/import"
              element={
                <PageErrorBoundary>
                  <Suspense fallback={<PageLoadingSpinner />}>
                    <ImportPage />
                  </Suspense>
                </PageErrorBoundary>
              }
            />
            <Route
              path="/reports"
              element={
                <PageErrorBoundary>
                  <Suspense fallback={<PageLoadingSpinner />}>
                    <ReportsPage />
                  </Suspense>
                </PageErrorBoundary>
              }
            />
            <Route
              path="/reference/education-code"
              element={
                <PageErrorBoundary>
                  <Suspense fallback={<PageLoadingSpinner />}>
                    <LegalReferencePage />
                  </Suspense>
                </PageErrorBoundary>
              }
            />
            <Route
              path="/funding"
              element={
                <PageErrorBoundary>
                  <Suspense fallback={<PageLoadingSpinner />}>
                    <FundingPage />
                  </Suspense>
                </PageErrorBoundary>
              }
            />
            <Route
              path="/settings"
              element={
                <PageErrorBoundary>
                  <Suspense fallback={<PageLoadingSpinner />}>
                    <SettingsPage />
                  </Suspense>
                </PageErrorBoundary>
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
