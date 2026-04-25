import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function Login({ onLogin, authError }: { onLogin: () => void; authError?: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Show authorization error from App-level allowlist check
  const displayError = authError || error;

  const handleLogin = async () => {
    if (!email || !password) { setError("Bitte E-Mail und Passwort eingeben"); return; }
    setLoading(true);
    setError("");

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError("Login fehlgeschlagen — falsches Passwort oder E-Mail");
      setLoading(false);
    } else {
      onLogin();
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <img src="/favicon.png" alt="adslift" className="h-16 w-16 rounded-xl" />
          </div>
          <p className="text-sm text-muted-foreground">Agency Operating System</p>
        </div>

        {/* Login Card */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Anmelden</h2>
              <p className="text-xs text-muted-foreground">Melde dich mit deinem Account an.</p>
            </div>

            {displayError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                <p className="text-xs text-red-500">{displayError}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>E-Mail</Label>
              <Input
                type="email"
                placeholder="name@adslift.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Passwort</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button className="w-full" onClick={handleLogin} disabled={loading}>
              <LogIn className="mr-2 h-4 w-4" />
              {loading ? "Anmelden..." : "Anmelden"}
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-[10px] text-muted-foreground">
          adslift OS · Nur für autorisierte Nutzer
        </p>
      </div>
    </div>
  );
}
