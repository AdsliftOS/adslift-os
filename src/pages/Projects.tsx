import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Project = {
  id: number;
  name: string;
  client: string;
  dueDate: string;
  assignees: string[];
};

const columns: { title: string; status: string; color: string; items: Project[] }[] = [
  {
    title: "To Do",
    status: "todo",
    color: "bg-muted-foreground",
    items: [
      { id: 1, name: "Competitor Analysis", client: "Nova", dueDate: "Mar 25", assignees: ["JD"] },
      { id: 2, name: "Content Calendar Q2", client: "TerraFin", dueDate: "Apr 1", assignees: ["SK", "AL"] },
    ],
  },
  {
    title: "In Progress",
    status: "progress",
    color: "bg-primary",
    items: [
      { id: 3, name: "Brand Refresh", client: "Acme Co", dueDate: "Mar 15", assignees: ["MR"] },
      { id: 4, name: "Website Redesign", client: "Bolt", dueDate: "Mar 18", assignees: ["JD", "SK"] },
      { id: 5, name: "Email Automation", client: "TerraFin", dueDate: "Mar 22", assignees: ["AL"] },
    ],
  },
  {
    title: "In Review",
    status: "review",
    color: "bg-warning",
    items: [
      { id: 6, name: "Q1 Social Campaign", client: "Nova", dueDate: "Mar 14", assignees: ["MR", "JD"] },
    ],
  },
  {
    title: "Done",
    status: "done",
    color: "bg-success",
    items: [
      { id: 7, name: "SEO Audit Report", client: "Prism Labs", dueDate: "Mar 10", assignees: ["SK"] },
      { id: 8, name: "PPC Setup", client: "Acme Co", dueDate: "Mar 8", assignees: ["AL"] },
    ],
  },
];

export default function Projects() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="text-sm text-muted-foreground">Track all active work across your agency.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {columns.map((col) => (
          <div key={col.status} className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className={`h-2 w-2 rounded-full ${col.color}`} />
              <h2 className="text-sm font-semibold">{col.title}</h2>
              <span className="text-xs text-muted-foreground ml-auto">{col.items.length}</span>
            </div>
            <div className="space-y-2">
              {col.items.map((item) => (
                <Card key={item.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-3 space-y-2">
                    <p className="text-sm font-medium leading-tight">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.client}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{item.dueDate}</span>
                      <div className="flex -space-x-1">
                        {item.assignees.map((a) => (
                          <span
                            key={a}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground ring-2 ring-card"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
