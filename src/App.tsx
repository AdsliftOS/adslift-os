import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import ProjectManager from "./pages/ProjectManager";
import Clients from "./pages/Clients";
import Finances from "./pages/Finances";
import Settings from "./pages/Settings";
import TimeTracking from "./pages/TimeTracking";
import Sales from "./pages/Sales";
import Calendar from "./pages/Calendar";
import Tasks from "./pages/Tasks";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} themes={["light", "dark", "anthrazit"]}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Onboarding — standalone, no sidebar */}
            <Route path="/onboarding" element={<Onboarding />} />
            {/* Main app with sidebar */}
            <Route path="*" element={
              <AppLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/projects" element={<ProjectManager />} />
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/finances" element={<Finances />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/time" element={<TimeTracking />} />
                  <Route path="/sales" element={<Sales />} />
                  <Route path="/calendar" element={<Calendar />} />
                  <Route path="/tasks" element={<Tasks />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AppLayout>
            } />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
