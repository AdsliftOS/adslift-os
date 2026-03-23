import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/lib/supabase";
import { generateAutoTasks } from "@/lib/autoTasks";
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
import AuthCallback from "./pages/AuthCallback";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} themes={["light", "dark", "anthrazit"]}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes — no login required */}
              <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/onboarding/finanzberater" element={<OnboardingFinanzberater />} />
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* Everything else requires login */}
              <Route path="*" element={
                loggedIn ? (
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/projects" element={<ProjectManager />} />
                      <Route path="/clients" element={<Clients />} />
                      <Route path="/finances" element={<Finances />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/time" element={<TimeTracking />} />
                      <Route path="/sales" element={<Sales />} />
                      <Route path="/meta-ads" element={<MetaAds />} />
                      <Route path="/calendar" element={<Calendar />} />
                      <Route path="/tasks" element={<Tasks />} />
                  <Route path="/files" element={<Files />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
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
