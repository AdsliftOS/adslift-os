import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { handleAuthCallback } from "@/lib/google-calendar";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("Verbinde Google Calendar...");

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      setStatus(`Fehler: ${error}`);
      setTimeout(() => navigate("/calendar", { replace: true }), 3000);
      return;
    }

    if (!code && !window.location.hash.includes("access_token")) {
      setStatus("Kein Auth-Code erhalten. Weiterleitung...");
      setTimeout(() => navigate("/calendar", { replace: true }), 2000);
      return;
    }

    handleAuthCallback().then((success) => {
      if (success) {
        setStatus("Verbunden! Weiterleitung...");
      } else {
        setStatus("Verbindung fehlgeschlagen. Weiterleitung...");
      }
      setTimeout(() => navigate("/calendar", { replace: true }), 1000);
    }).catch(() => {
      setStatus("Fehler bei der Verbindung. Weiterleitung...");
      setTimeout(() => navigate("/calendar", { replace: true }), 2000);
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <img src="/favicon.png" alt="adslift" className="h-12 w-12 rounded-xl mx-auto mb-3 animate-pulse" />
        <p className="text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
