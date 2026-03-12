import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthGate } from "@/components/AuthGate";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { LoginPage } from "@/pages/LoginPage";
import { SecurityPage } from "@/pages/SecurityPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { StudentsPage } from "@/pages/StudentsPage";
import { StudentDetailPage } from "@/pages/StudentDetailPage";
import { CompliancePage } from "@/pages/CompliancePage";
import { CaseWorkspacePage } from "@/pages/compliance/CaseWorkspacePage";
import { FundingPage } from "@/pages/FundingPage";
import { ActionCenterPage } from "@/pages/ActionCenterPage";
import { ImportPage } from "@/pages/ImportPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { LegalReferencePage } from "@/pages/LegalReferencePage";
import { SettingsPage } from "@/pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/security" element={<SecurityPage />} />

        <Route element={<AuthGate />}>
          <Route element={<ConsoleLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/student/:id" element={<StudentDetailPage />} />
            <Route path="/compliance" element={<CompliancePage />} />
            <Route path="/compliance/cases/:caseId" element={<CaseWorkspacePage />} />
            <Route path="/actions" element={<ActionCenterPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reference/education-code" element={<LegalReferencePage />} />
            <Route path="/funding" element={<FundingPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
