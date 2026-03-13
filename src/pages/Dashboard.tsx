import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, FolderKanban, Users, TrendingUp } from "lucide-react";

const stats = [
  { label: "Active Projects", value: "12", change: "+2 this week", icon: FolderKanban },
  { label: "Total Clients", value: "34", change: "+3 this month", icon: Users },
  { label: "Revenue (MTD)", value: "$48,200", change: "+12% vs last month", icon: DollarSign },
  { label: "Team Utilization", value: "87%", change: "+5% vs last week", icon: TrendingUp },
];

const recentProjects = [
  { name: "Brand Refresh — Acme Co", status: "In Progress", statusColor: "bg-primary" },
  { name: "Q1 Social Campaign — Nova", status: "In Review", statusColor: "bg-warning" },
  { name: "Website Redesign — Bolt", status: "Active", statusColor: "bg-success" },
  { name: "SEO Audit — Prism Labs", status: "Blocked", statusColor: "bg-destructive" },
  { name: "Email Flows — TerraFin", status: "Active", statusColor: "bg-success" },
];

const upcomingDeadlines = [
  { task: "Deliver brand guidelines", project: "Acme Co", due: "Mar 15" },
  { task: "Launch landing page", project: "Bolt", due: "Mar 18" },
  { task: "Submit ad creatives", project: "Nova", due: "Mar 20" },
  { task: "Monthly report", project: "Prism Labs", due: "Mar 22" },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome back. Here's your agency at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{s.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentProjects.map((p) => (
              <div key={p.name} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm font-medium">{p.name}</span>
                <Badge variant="secondary" className="gap-1.5 font-normal">
                  <span className={`h-1.5 w-1.5 rounded-full ${p.statusColor}`} />
                  {p.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming Deadlines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingDeadlines.map((d) => (
              <div key={d.task} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{d.task}</p>
                  <p className="text-xs text-muted-foreground">{d.project}</p>
                </div>
                <span className="text-sm text-muted-foreground">{d.due}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
