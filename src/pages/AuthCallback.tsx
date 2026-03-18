import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { handleAuthCallback } from "@/lib/google-calendar";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    handleAuthCallback().then(() => {
      navigate("/calendar", { replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Verbinde Google Calendar...</p>
    </div>
  );
}
