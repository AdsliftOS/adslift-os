import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ofrvoxupatowfatpleji.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mcnZveHVwYXRvd2ZhdHBsZWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4Mjk0NTQsImV4cCI6MjA4OTQwNTQ1NH0.AIqVTa0JK_srhTaD-a6CH9Ik94FATjhX8P-ilToCO0U",
);

const tables = [
  "pipeline_step_templates",
  "pipeline_projects",
  "pipeline_steps",
  "pipeline_step_files",
];

for (const t of tables) {
  const { data, error, count } = await supabase
    .from(t)
    .select("*", { count: "exact", head: true });
  if (error) {
    console.log(`[fail] ${t}: ${error.message}`);
  } else {
    console.log(`[ok]   ${t}: ${count} rows`);
  }
}

// Check default templates
const { data: tpl } = await supabase
  .from("pipeline_step_templates")
  .select("name")
  .eq("is_default", true)
  .order("sort_order");
console.log("\nDefault templates:", tpl?.map((t) => t.name).join(" · ") || "(none)");
