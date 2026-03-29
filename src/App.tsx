import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { GuestModeProvider } from "@/hooks/useGuestMode";
import { SelectedChildProvider } from "@/hooks/useSelectedChild";
import { AuthGate } from "@/components/auth/AuthGate";
import { PostLoginRouter } from "@/components/auth/PostLoginRouter";
import { AdminAuthGate } from "@/components/admin/AdminAuthGate";
import { AdminLayout } from "@/components/admin/AdminLayout";
import Index from "./pages/Index";
import ChildrenScreen from "./pages/ChildrenScreen";
import ContactsPage from "./pages/ContactsPage";
import InsightDetailPage from "./pages/InsightDetailPage";
import NotFound from "./pages/NotFound";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import LegalPage from "./pages/LegalPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import SchoolProfilePage from "./pages/admin/SchoolProfilePage";
import CommsPage from "./pages/admin/CommsPage";
import AttendanceTriagePage from "./pages/admin/AttendanceTriagePage";
import DocumentWorkstationPage from "./pages/admin/DocumentWorkstationPage";
import StaffAccessPage from "./pages/StaffAccessPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <GuestModeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/legal/:slug" element={<LegalPage />} />
              <Route path="/staff-access" element={<StaffAccessPage />} />
              <Route path="/post-login" element={<PostLoginRouter />} />
              <Route path="/admin/*" element={
                <AdminAuthGate>
                  <Routes>
                    <Route element={<AdminLayout />}>
                      <Route index element={<AdminDashboard />} />
                      <Route path="school-profile" element={<SchoolProfilePage />} />
                      <Route path="comms" element={<CommsPage />} />
                      <Route path="attendance-triage" element={<AttendanceTriagePage />} />
                      <Route path="documents" element={<DocumentWorkstationPage />} />
                      <Route path="*" element={<NotFound />} />
                    </Route>
                  </Routes>
                </AdminAuthGate>
              } />
              <Route path="/*" element={
                <AuthGate>
                  <SelectedChildProvider>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/children" element={<ChildrenScreen />} />
                      <Route path="/contacts" element={<ContactsPage />} />
                      <Route path="/insights/:id" element={<InsightDetailPage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </SelectedChildProvider>
                </AuthGate>
              } />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </GuestModeProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
