import { useState, useMemo, useRef, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useLocation } from "react-router-dom";
import { useClients } from "@/store/clients";
import { useProjects } from "@/store/projects";
import { NotificationCenter } from "@/components/NotificationCenter";

const navPages = [
  { title: "Dashboard", path: "/" },
  { title: "Pipeline / Projekte", path: "/pipeline" },
  { title: "Clients / Kunden", path: "/clients" },
  { title: "Finanzen / Cash-In / Cash-Out", path: "/finances" },
  { title: "Sales", path: "/sales" },
  { title: "Einstellungen / Settings", path: "/settings" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [clients] = useClients();
  const [projects] = useProjects();

  // Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { clients: [], projects: [], pages: [] };
    const q = searchQuery.toLowerCase();
    return {
      clients: clients.filter((c) => c.name.toLowerCase().includes(q) || c.contact.toLowerCase().includes(q)).slice(0, 4),
      projects: projects.filter((p) => p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q)).slice(0, 4),
      pages: navPages.filter((p) => p.title.toLowerCase().includes(q)),
    };
  }, [searchQuery, clients, projects]);

  const hasResults = searchResults.clients.length > 0 || searchResults.projects.length > 0 || searchResults.pages.length > 0;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchOpen && searchRef.current && !searchRef.current.closest(".search-container")?.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [searchOpen]);

  // Close search on navigate
  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery("");
  }, [location.pathname]);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-4 shrink-0 border-b border-white/[0.06] bg-background/60 backdrop-blur-glass">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground hover:bg-white/[0.06]" />
              {/* Search */}
              <div className="relative search-container">
                <button
                  onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50); }}
                  className="hidden sm:flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[13px] text-muted-foreground w-64 hover:border-primary/30 hover:bg-primary/[0.06] transition-colors"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span className="flex-1 text-left">Suchen…</span>
                  <kbd className="text-[10px] bg-white/[0.06] border border-white/[0.08] text-muted-foreground/80 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
                </button>

                {searchOpen && (
                  <div className="absolute top-0 left-0 w-80 sm:w-96 z-50">
                    <div className="rounded-xl border border-white/[0.08] bg-card/95 backdrop-blur-glass shadow-glass-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 border-b">
                        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Input
                          ref={searchRef}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Kunde, Projekt oder Seite suchen..."
                          className="border-0 shadow-none focus-visible:ring-0 px-0"
                        />
                        <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>

                      {searchQuery && (
                        <div className="max-h-80 overflow-y-auto p-2">
                          {!hasResults && (
                            <p className="text-sm text-muted-foreground text-center py-6">Keine Ergebnisse für "{searchQuery}"</p>
                          )}

                          {searchResults.pages.length > 0 && (
                            <div className="mb-2">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold px-2 py-1">Seiten</div>
                              {searchResults.pages.map((page) => (
                                <button
                                  key={page.path}
                                  onClick={() => navigate(page.path)}
                                  className="w-full text-left px-2 py-2 rounded-md hover:bg-accent text-sm flex items-center gap-2"
                                >
                                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                                  {page.title}
                                </button>
                              ))}
                            </div>
                          )}

                          {searchResults.clients.length > 0 && (
                            <div className="mb-2">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold px-2 py-1">Kunden</div>
                              {searchResults.clients.map((c) => (
                                <button
                                  key={c.id}
                                  onClick={() => navigate("/clients")}
                                  className="w-full text-left px-2 py-2 rounded-md hover:bg-accent text-sm flex items-center gap-2"
                                >
                                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <span className="text-[9px] font-bold text-primary">{c.name.slice(0, 2).toUpperCase()}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="font-medium">{c.name}</span>
                                    <span className="text-muted-foreground ml-2 text-xs">{c.contact}</span>
                                  </div>
                                  <Badge variant={c.status === "Active" ? "default" : "secondary"} className={`text-[9px] ${c.status === "Active" ? "bg-emerald-500" : ""}`}>
                                    {c.status === "Active" ? "Aktiv" : "Pausiert"}
                                  </Badge>
                                </button>
                              ))}
                            </div>
                          )}

                          {searchResults.projects.length > 0 && (
                            <div>
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold px-2 py-1">Projekte</div>
                              {searchResults.projects.map((p) => (
                                <button
                                  key={p.id}
                                  onClick={() => navigate("/pipeline")}
                                  className="w-full text-left px-2 py-2 rounded-md hover:bg-accent text-sm flex items-center gap-2"
                                >
                                  <div className="h-6 w-6 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
                                    <span className="text-[9px] font-bold text-violet-500">{p.client.slice(0, 2).toUpperCase()}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="font-medium truncate">{p.name}</span>
                                    <span className="text-muted-foreground ml-2 text-xs">{p.client}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {!searchQuery && (
                        <div className="p-3 text-center text-xs text-muted-foreground">
                          Tippe um Kunden, Projekte oder Seiten zu finden
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Notifications */}
            <NotificationCenter />
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
