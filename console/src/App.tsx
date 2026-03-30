import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthGate } from "@/components/AuthGate";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { RequireRole, RequireRoute } from "@/components/RequirePermission";
import { MembershipProvider } from "@/context/MembershipContext";
import { PageErrorBoundary } from "@/components/shared/PageErrorBoundary";
import { PageLoadingSpinner } from "@/components/shared/PageLoadingSpinner";

import { LoginPage } from "@/pages/LoginPage";
import { SecurityPage } from "@/pages/SecurityPage";

const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const StudentsPage = lazy(() =>
  import("@/pages/StudentsPage").then((m) => ({ default: m.StudentsPage }))
);
const StudentDetailPage = lazy(() =>
  import("@/pages/StudentDetailPage").then((m) => ({ default: m.StudentDetailPage }))
);
const CompliancePage = lazy(() =>
  import("@/pages/CompliancePage").then((m) => ({ default: m.CompliancePage }))
);
const CaseWorkspacePage = lazy(() =>
  import("@/pages/compliance/CaseWorkspacePage").then((m) => ({ default: m.CaseWorkspacePage }))
);
const FundingPage = lazy(() =>
  import("@/pages/FundingPage").then((m) => ({ default: m.FundingPage }))
);
const ActionCenterPage = lazy(() =>
  import("@/pages/ActionCenterPage").then((m) => ({ default: m.ActionCenterPage }))
);
const ImportPage = lazy(() =>
  import("@/pages/ImportPage").then((m) => ({ default: m.ImportPage }))
);
const ReportsPage = lazy(() =>
  import("@/pages/ReportsPage").then((m) => ({ default: m.ReportsPage }))
);
const LegalReferencePage = lazy(() =>
  import("@/pages/LegalReferencePage").then((m) => ({ default: m.LegalReferencePage }))
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);

function Page({ children }: { children: React.ReactNode }) {
  return (
    <PageErrorBoundary>
      <Suspense fallback={<PageLoadingSpinner />}>
        {children}
      </Suspense>
    </PageErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <MembershipProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/security" element={<SecurityPage />} />

          <Route element={<AuthGate />}>
            <Route element={<ConsoleLayout />}>

              <Route path="/dashboard" element={<Page><DashboardPage /></Page>} />

              <Route path="/students" element={
                <RequireRoute path="/students"><Page><StudentsPage /></Page></RequireRoute>
              } />
              <Route path="/student/:id" element={
                <RequireRoute path="/students"><Page><StudentDetailPage /></Page></RequireRoute>
              } />
              <Route path="/compliance" element={
                <RequireRoute path="/compliance"><Page><CompliancePage /></Page></RequireRoute>
              } />
              <Route path="/compliance/cases/:caseId" element={
                <RequireRoute path="/compliance"><Page><CaseWorkspacePage /></Page></RequireRoute>
              } />
              <Route path="/actions" element={
                <RequireRoute path="/actions"><Page><ActionCenterPage /></Page></RequireRoute>
              } />
              <Route path="/reports" element={
                <RequireRoute path="/reports"><Page><ReportsPage /></Page></RequireRoute>
              } />
              <Route path="/reference/education-code" element={
                <RequireRoute path="/reference/education-code"><Page><LegalReferencePage /></Page></RequireRoute>
              } />
              <Route path="/funding" element={
                <RequireRoute path="/funding"><Page><FundingPage /></Page></RequireRoute>
              } />
              <Route path="/settings" element={
                <RequireRoute path="/settings"><Page><SettingsPage /></Page></RequireRoute>
              } />
              <Route path="/import" element={
                <RequireRole role="district_admin"><Page><ImportPage /></Page></RequireRole>
              } />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>
        </Routes>
      </MembershipProvider>
    </BrowserRouter>
  );
}