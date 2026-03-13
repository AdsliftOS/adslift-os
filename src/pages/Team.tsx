import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const members = [
  { initials: "JD", name: "Jessica Davis", role: "Project Manager", projects: 4, utilization: 92, status: "Available" },
  { initials: "SK", name: "Sam Kim", role: "SEO Specialist", projects: 3, utilization: 85, status: "Available" },
  { initials: "MR", name: "Maria Rodriguez", role: "Creative Director", projects: 2, utilization: 78, status: "In Meeting" },
  { initials: "AL", name: "Alex Lin", role: "Content Strategist", projects: 3, utilization: 90, status: "Available" },
  { initials: "TP", name: "Tom Patel", role: "PPC Specialist", projects: 2, utilization: 65, status: "On Leave" },
];

export default function Team() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">Monitor workload and team availability.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Team Size</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{members.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Avg Utilization</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{Math.round(members.reduce((s, m) => s + m.utilization, 0) / members.length)}%</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Available Now</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{members.filter(m => m.status === "Available").length}</div></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => (
          <Card key={m.initials}>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {m.initials}
                </span>
                <div>
                  <p className="text-sm font-semibold">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.role}</p>
                </div>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {m.status}
                </Badge>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Utilization</span>
                  <span>{m.utilization}%</span>
                </div>
                <Progress value={m.utilization} className="h-1.5" />
              </div>
              <p className="text-xs text-muted-foreground">{m.projects} active projects</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
