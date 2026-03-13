import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const clients = [
  { name: "Acme Co", contact: "John Smith", email: "john@acme.co", projects: 3, revenue: "$18,400", status: "Active" },
  { name: "Nova", contact: "Sarah Lee", email: "sarah@nova.io", projects: 2, revenue: "$12,800", status: "Active" },
  { name: "Bolt", contact: "Mike Chen", email: "mike@bolt.dev", projects: 1, revenue: "$8,500", status: "Active" },
  { name: "Prism Labs", contact: "Amy Park", email: "amy@prism.co", projects: 1, revenue: "$4,200", status: "Paused" },
  { name: "TerraFin", contact: "David Wu", email: "david@terrafin.com", projects: 2, revenue: "$9,300", status: "Active" },
];

export default function Clients() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <p className="text-sm text-muted-foreground">Manage your client relationships and accounts.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Clients</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{clients.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{clients.filter(c => c.status === "Active").length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">$53,200</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center">Projects</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.name} className="cursor-pointer hover:bg-accent/50">
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.contact}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email}</TableCell>
                  <TableCell className="text-center">{c.projects}</TableCell>
                  <TableCell className="text-right">{c.revenue}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={c.status === "Active" ? "default" : "secondary"}>
                      {c.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
