import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { handleAuthCallback } from "@/lib/google-calendar";
import { handleGmailCallback } from "@/lib/gmail-auth";

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState("Verbinde...");
  const [debug, setDebug] = useState("");

  useEffect(() => {
    const fullUrl = window.location.href;
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const source = searchParams.get("source");
    const isGmail = source === "gmail";

    setStatus(isGmail ? "Verbinde Gmail..." : "Verbinde Google Calendar...");
    setDebug(`URL: ${fullUrl}\nCode: ${code ? "vorhanden" : "fehlt"}\nError: ${error || "keine"}\nSource: ${source || "calendar"}`);

    if (error) {
      setStatus(`Fehler von Google: ${error}`);
      return;
    }

    if (!code) {
      setStatus("Kein Auth-Code von Google erhalten.");
      return;
    }

    setStatus("Code erhalten — tausche gegen Token...");

    if (isGmail) {
      handleGmailCallback().then((success) => {
        if (success) {
          setStatus("Gmail verbunden!");
          setTimeout(() => navigate("/mail", { replace: true }), 1500);
        } else {
          setStatus("Token-Austausch fehlgeschlagen.");
        }
      }).catch((err) => {
        setStatus(`Fehler: ${err.message}`);
      });
    } else {
      handleAuthCallback().then((success) => {
        if (success) {
          setStatus("Verbunden!");
          setTimeout(() => navigate("/calendar", { replace: true }), 1500);
        } else {
          const apiError = (window as any).__googleAuthError || "Unbekannt";
          setStatus("Token-Austausch fehlgeschlagen.");
          setDebug((prev) => prev + "\nAPI Response: " + apiError);
        }
      }).catch((err) => {
        setStatus(`Fehler: ${err.message}`);
      });
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <img src="/favicon.png" alt="adslift" className="h-12 w-12 rounded-xl mx-auto mb-3 animate-pulse" />
        <p className="text-foreground font-medium">{status}</p>
        <pre className="text-[10px] text-muted-foreground mt-4 text-left bg-muted/50 rounded p-3 overflow-auto">{debug}</pre>
      </div>
    </div>
  );
}
