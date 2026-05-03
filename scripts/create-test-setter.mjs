import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ofrvoxupatowfatpleji.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mcnZveHVwYXRvd2ZhdHBsZWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4Mjk0NTQsImV4cCI6MjA4OTQwNTQ1NH0.AIqVTa0JK_srhTaD-a6CH9Ik94FATjhX8P-ilToCO0U";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const email = "timtester@gmail.com";
const password = "SetterTest2026!";

console.log(`[info] Creating auth user for ${email}…`);

const { data, error } = await supabase.auth.signUp({
  email,
  password,
});

if (error) {
  console.error("[error]", error.message);
  if (error.message.includes("already registered")) {
    console.log("[info] User existiert bereits — versuche Login zum Verifizieren.");
    const { data: l, error: lerr } = await supabase.auth.signInWithPassword({ email, password });
    if (lerr) {
      console.error("[error] Login fehlgeschlagen:", lerr.message);
      process.exit(1);
    }
    console.log("[ok] Login funktioniert. User-ID:", l.user?.id);
    process.exit(0);
  }
  process.exit(1);
}

if (data.user && data.session) {
  console.log("[ok] User angelegt + automatisch eingeloggt. ID:", data.user.id);
} else if (data.user) {
  console.log("[warn] User angelegt, aber Session = null.");
  console.log("       → 'Confirm email' ist im Supabase-Projekt aktiv.");
  console.log("       → User-ID:", data.user.id);
  console.log("");
  console.log("Lösung A: Im Supabase Dashboard → Authentication → Users den User");
  console.log("           manuell auf 'Confirmed' setzen (3 Sekunden Klick).");
  console.log("Lösung B: Authentication → Providers → Email → 'Confirm email' AUS,");
  console.log("           dann nochmal dieses Script laufen lassen.");
}
