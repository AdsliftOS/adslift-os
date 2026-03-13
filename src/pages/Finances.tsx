import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, TrendingUp, TrendingDown, Clock } from "lucide-react";

const invoices = [
  { id: "INV-001", client: "Acme Co", amount: "$6,500", date: "Mar 1", status: "Paid" },
  { id: "INV-002", client: "Nova", amount: "$4,200", date: "Mar 3", status: "Paid" },
  { id: "INV-003", client: "Bolt", amount: "$8,500", date: "Mar 5", status: "Pending" },
  { id: "INV-004", client: "Prism Labs", amount: "$2,100", date: "Mar 8", status: "Overdue" },
  { id: "INV-005", client: "TerraFin", amount: "$3,800", date: "Mar 10", status: "Pending" },
  { id: "INV-006", client: "Acme Co", amount: "$5,900", date: "Mar 12", status: "Draft" },
];

const statusVariant = (status: string) => {
  switch (status) {
    case "Paid": return "default";
    case "Pending": return "secondary";
    case "Overdue": return "destructive";
    default: return "outline";
  }
};

export default function Finances() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Finances</h1>
        <p className="text-sm text-muted-foreground">Track revenue, invoices, and cash flow.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue (MTD)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$48,200</div>
            <p className="text-xs text-success flex items-center gap-1 mt-1"><TrendingUp className="h-3 w-3" /> +12% vs last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$14,400</div>
            <p className="text-xs text-muted-foreground mt-1">3 invoices pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expenses (MTD)</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$12,300</div>
            <p className="text-xs text-muted-foreground mt-1">-5% vs last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit Margin</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">74.5%</div>
            <p className="text-xs text-success flex items-center gap-1 mt-1"><TrendingUp className="h-3 w-3" /> Healthy</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Invoices</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-accent/50">
                  <TableCell className="font-medium">{inv.id}</TableCell>
                  <TableCell>{inv.client}</TableCell>
                  <TableCell className="text-muted-foreground">{inv.date}</TableCell>
                  <TableCell className="text-right font-medium">{inv.amount}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={statusVariant(inv.status) as any}>{inv.status}</Badge>
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
