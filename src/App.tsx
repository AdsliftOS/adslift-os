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
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
import Academy from "./pages/Academy";
import AcademyPortal from "./pages/AcademyPortal";
import AuthCallback from "./pages/AuthCallback";
import Login from "./pages/Login";
import Mail from "./pages/Mail";
import MyArea from "./pages/MyArea";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Authorization gate — only allow login for active members of the
// team_members table. The new-hire flow is: add the person in
// Settings → Team (status="active") and they can log in.
async function isAuthorized(email: string): Promise<boolean> {
  if (!email) return false;
  const { data, error } = await supabase
    .from("team_members")
    .select("id, status")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (error) {
    console.error("Authorization lookup failed:", error);
    // Fail-closed: if the table check fails, deny.
    return false;
  }
  return !!data && data.status === "active";
}

const App = () => {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null); // null = loading
  const [userEmail, setUserEmail] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const handleSession = async (session: any) => {
      if (cancelled) return;
      if (!session) {
        setLoggedIn(false);
        setUserEmail("");
        return;
      }
      const email = session.user?.email || "";
      const ok = await isAuthorized(email);
      if (cancelled) return;
      if (!ok) {
        // Session exists but email is not in the team_members allowlist.
        // Kick them out immediately.
        await supabase.auth.signOut();
        setAuthError(
          `Zugriff verweigert für ${email}. Bitte bei Alex melden.`,
        );
        setLoggedIn(false);
        setUserEmail("");
        return;
      }
      setLoggedIn(true);
      setUserEmail(email);
      setAuthError(null);
      generateAutoTasks();
      generateCloseAutoTasks();
      generateNotifications(email).then(() => loadNotifications());
    };

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => handleSession(session));

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => handleSession(session),
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
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
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/academy" element={<AcademyPortal />} />

              {/* Everything else requires login */}
              <Route path="*" element={
                loggedIn ? (
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/me" element={<MyArea />} />
                      <Route path="/projects" element={<ProjectManager />} />
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
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                ) : (
                  <Login onLogin={() => setLoggedIn(true)} authError={authError} />
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
