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
async function isAuthorized(email: string): Promise<{ ok: boolean; reason: string }> {
  if (!email) return { ok: false, reason: "Keine E-Mail im Session-Token" };

  // Hard timeout — never let auth check hang the loading screen.
  const timeout = new Promise<{ data: any; error: any }>((resolve) =>
    setTimeout(
      () => resolve({ data: null, error: { message: "Auth-Check Timeout (3s)" } }),
      3000,
    ),
  );
  const query = supabase
    .from("team_members")
    .select("id, status")
    .eq("email", email.toLowerCase())
    .limit(1);

  const { data, error } = await Promise.race([query, timeout]);

  if (error) {
    console.error("Authorization lookup failed:", error);
    return { ok: false, reason: `team_members Abfrage: ${error.message}` };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { ok: false, reason: `${email} ist nicht in team_members eingetragen` };
  }
  if (row.status !== "active") {
    return { ok: false, reason: `${email} ist auf Status "${row.status}"` };
  }
  return { ok: true, reason: "" };
}

const App = () => {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null); // null = loading
  const [userEmail, setUserEmail] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Last-resort safety net: if we are still in `loggedIn === null` after 8s,
    // something is very wrong (network, supabase, blocked requests). Drop the
    // user on the login screen so they can at least retry.
    const fallbackTimer = setTimeout(() => {
      if (cancelled) return;
      setLoggedIn((prev) => {
        if (prev === null) {
          setAuthError(
            "Auth lädt zu lange — bitte Internet-Verbindung prüfen oder Browser-Konsole öffnen.",
          );
          return false;
        }
        return prev;
      });
    }, 12000);

    const handleSession = async (session: any) => {
      try {
        if (cancelled) return;
        if (!session) {
          setLoggedIn(false);
          setUserEmail("");
          return;
        }
        const email = session.user?.email || "";
        const result = await isAuthorized(email);
        if (cancelled) return;
        if (!result.ok) {
          // Session exists but email is not in the team_members allowlist.
          // Kick them out immediately, surface the reason.
          await supabase.auth.signOut().catch(() => {});
          setAuthError(`Zugriff verweigert: ${result.reason}`);
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
      } catch (err: any) {
        console.error("handleSession crashed:", err);
        if (cancelled) return;
        // Fail-open to login screen with error so user is never stuck on loader.
        setAuthError(`Auth-Fehler: ${err?.message || String(err)}`);
        setLoggedIn(false);
        setUserEmail("");
      }
    };

    // Check existing session — wrap in race so a hanging Supabase call can't
    // freeze the loader. After 4s without an answer we treat it as "no session"
    // and let the user log in fresh.
    const sessionTimeout = new Promise<{ data: { session: any } }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null } }), 2500),
    );
    Promise.race([supabase.auth.getSession(), sessionTimeout]).then(
      ({ data: { session } }) => handleSession(session),
    );

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => handleSession(session),
    );

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
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
