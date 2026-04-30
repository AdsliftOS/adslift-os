import React, { useState, useEffect } from "react";

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return <div style={{ padding: 40, color: "red", background: "#111", minHeight: "100vh" }}><h1>Fehler</h1><pre style={{ whiteSpace: "pre-wrap" }}>{this.state.error.message}{"\n"}{this.state.error.stack}</pre></div>;
    return this.props.children;
  }
}
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { useCurrentMember, isLeadershipRole } from "@/store/teamMembers";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/lib/supabase";
import { generateAutoTasks } from "@/lib/autoTasks";
import { generateCloseAutoTasks } from "@/lib/closeAutoTasks";
import { generateNotifications } from "@/lib/notificationGenerator";
import { loadNotifications } from "@/store/notifications";
import Dashboard from "./pages/Dashboard";
import ProjectManager from "./pages/ProjectManager";
import Clients from "./pages/Clients";
import Finances from "./pages/Finances";
import Settings from "./pages/Settings";
import TimeTracking from "./pages/TimeTracking";
import Sales from "./pages/Sales";
import MetaAds from "./pages/MetaAds";
import Calendar from "./pages/Calendar";
import Tasks from "./pages/Tasks";
import Files from "./pages/Files";
import Onboarding from "./pages/Onboarding";
import OnboardingFinanzberater from "./pages/OnboardingFinanzberater";
import OnboardingPortal from "./pages/OnboardingPortal";
import OnboardingAdmin from "./pages/OnboardingAdmin";
import Academy from "./pages/Academy";
import AcademyPortal from "./pages/AcademyPortal";
import AuthCallback from "./pages/AuthCallback";
import Login from "./pages/Login";
import Mail from "./pages/Mail";
import MyArea from "./pages/MyArea";
import Pipeline from "./pages/Pipeline";
import PipelinePortal from "./pages/PipelinePortal";
import TeamOverview from "./pages/TeamOverview";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Routes filtered by role. Setters/Closer get only /me and /calendar; any
// other URL bounces them back to /me. Leadership keeps everything.
function RoleAwareRoutes() {
  const me = useCurrentMember();
  const leadership = me === null || isLeadershipRole(me.role);

  if (!leadership) {
    return (
      <Routes>
        <Route path="/me" element={<MyArea />} />
        <Route path="/calendar" element={<ErrorBoundary><Calendar /></ErrorBoundary>} />
        <Route path="*" element={<Navigate to="/me" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/me" element={<Navigate to="/" replace />} />
      <Route path="/team" element={<TeamOverview />} />
      <Route path="/projects" element={<ProjectManager />} />
      <Route path="/pipeline" element={<Pipeline />} />
      <Route path="/clients" element={<Clients />} />
      <Route path="/finances" element={<Finances />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/time" element={<TimeTracking />} />
      <Route path="/sales" element={<Sales />} />
      <Route path="/meta-ads" element={<MetaAds />} />
      <Route path="/calendar" element={<ErrorBoundary><Calendar /></ErrorBoundary>} />
      <Route path="/tasks" element={<Tasks />} />
      <Route path="/mail" element={<ErrorBoundary><Mail /></ErrorBoundary>} />
      <Route path="/files" element={<Files />} />
      <Route path="/academy-admin" element={<ErrorBoundary><Academy /></ErrorBoundary>} />
      <Route path="/onboarding-admin" element={<ErrorBoundary><OnboardingAdmin /></ErrorBoundary>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null); // null = loading
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session);
      setUserEmail(session?.user?.email || "");
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
      setUserEmail(session?.user?.email || "");
    });

    // Run auto-task generation and notification generation once on mount (after auth check)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        generateAutoTasks();
        generateCloseAutoTasks();
        generateNotifications(session.user?.email || "").then(() => loadNotifications());
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Loading state
  if (loggedIn === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <img src="/favicon.png" alt="adslift" className="h-12 w-12 rounded-xl mx-auto mb-3 animate-pulse" />
          <p className="text-sm text-muted-foreground">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} themes={["light", "dark", "anthrazit"]}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes — no login required */}
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/onboarding/finanzberater" element={<OnboardingFinanzberater />} />
              <Route path="/onboarding-portal/:token" element={<OnboardingPortal />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/academy" element={<AcademyPortal />} />
              <Route path="/p/:token" element={<PipelinePortal />} />

              {/* Everything else requires login */}
              <Route path="*" element={
                loggedIn ? (
                  <AppLayout>
                    <RoleAwareRoutes />
                  </AppLayout>
                ) : (
                  <Login onLogin={() => setLoggedIn(true)} />
                )
              } />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
