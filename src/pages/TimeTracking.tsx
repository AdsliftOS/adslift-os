import { useState } from "react";
import { format, startOfWeek, addDays, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";

type TimeEntry = {
  id: string;
  date: Date;
  hours: number;
  description: string;
  member: string;
};

const teamMembers = [
  { initials: "JD", name: "Jessica Davis" },
  { initials: "SK", name: "Sam Kim" },
  { initials: "MR", name: "Maria Rodriguez" },
  { initials: "AL", name: "Alex Lin" },
  { initials: "TP", name: "Tom Patel" },
];

const initialEntries: TimeEntry[] = [
  { id: "1", date: new Date(2026, 2, 9), hours: 3, description: "SEO keyword research", member: "Sam Kim" },
  { id: "2", date: new Date(2026, 2, 9), hours: 5, description: "Brand guidelines draft", member: "Maria Rodriguez" },
  { id: "3", date: new Date(2026, 2, 10), hours: 4, description: "Client call & strategy", member: "Jessica Davis" },
  { id: "4", date: new Date(2026, 2, 11), hours: 6, description: "Landing page wireframes", member: "Alex Lin" },
  { id: "5", date: new Date(2026, 2, 12), hours: 2, description: "Ad creative review", member: "Jessica Davis" },
  { id: "6", date: new Date(2026, 2, 13), hours: 7, description: "Content writing sprint", member: "Alex Lin" },
  { id: "7", date: new Date(2026, 2, 13), hours: 4, description: "PPC campaign setup", member: "Tom Patel" },
];

export default function TimeTracking() {
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 2, 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>(initialEntries);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({ hours: "", description: "", member: "" });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);

  const getEntriesForDay = (day: Date) => entries.filter((e) => isSameDay(e.date, day));
  const getTotalHoursForDay = (day: Date) => getEntriesForDay(day).reduce((s, e) => s + e.hours, 0);

  const selectedEntries = selectedDate ? getEntriesForDay(selectedDate) : [];
  const totalMonthHours = entries
    .filter((e) => e.date >= monthStart && e.date <= monthEnd)
    .reduce((s, e) => s + e.hours, 0);

  const handleAddEntry = () => {
    if (!selectedDate || !newEntry.hours || !newEntry.description || !newEntry.member) {
      toast.error("Please fill in all fields");
      return;
    }
    const entry: TimeEntry = {
      id: Date.now().toString(),
      date: selectedDate,
      hours: parseFloat(newEntry.hours),
      description: newEntry.description,
      member: newEntry.member,
    };
    setEntries([...entries, entry]);
    setNewEntry({ hours: "", description: "", member: "" });
    setDialogOpen(false);
    toast.success("Time entry added");
  };

  const handleDeleteEntry = (id: string) => {
    setEntries(entries.filter((e) => e.id !== id));
    toast.success("Entry removed");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Time Tracking</h1>
          <p className="text-sm text-muted-foreground">Log and review hours across your team.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 text-sm font-normal px-3 py-1.5">
            <Clock className="h-3.5 w-3.5" />
            {totalMonthHours}h this month
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Calendar */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base">{format(currentMonth, "MMMM yyyy")}</CardTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
                  {d}
                </div>
              ))}
              {Array.from({ length: startPadding }).map((_, i) => (
                <div key={`pad-${i}`} className="min-h-[80px]" />
              ))}
              {calendarDays.map((day) => {
                const dayHours = getTotalHoursForDay(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isToday = isSameDay(day, new Date());
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`min-h-[80px] rounded-md border p-1.5 text-left transition-colors hover:bg-accent ${
                      isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-transparent"
                    }`}
                  >
                    <span className={`text-xs font-medium ${isToday ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground" : ""}`}>
                      {format(day, "d")}
                    </span>
                    {dayHours > 0 && (
                      <div className="mt-1">
                        <span className="inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          {dayHours}h
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Day detail panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">
                {selectedDate ? format(selectedDate, "EEEE, MMM d") : "Select a day"}
              </CardTitle>
              {selectedDate && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Log Time
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Log Time — {format(selectedDate, "MMM d, yyyy")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          placeholder="What did you work on?"
                          value={newEntry.description}
                          onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Team Member</Label>
                        <Select value={newEntry.member} onValueChange={(v) => setNewEntry({ ...newEntry, member: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select member" />
                          </SelectTrigger>
                          <SelectContent>
                            {teamMembers.map((m) => (
                              <SelectItem key={m.initials} value={m.name}>
                                {m.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Hours</Label>
                        <Input
                          type="number"
                          min="0.5"
                          step="0.5"
                          max="24"
                          placeholder="e.g. 4"
                          value={newEntry.hours}
                          onChange={(e) => setNewEntry({ ...newEntry, hours: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleAddEntry}>Add Entry</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {!selectedDate && (
                <p className="text-sm text-muted-foreground">Click a day on the calendar to view and log time entries.</p>
              )}
              {selectedDate && selectedEntries.length === 0 && (
                <p className="text-sm text-muted-foreground">No entries for this day. Click "Log Time" to add one.</p>
              )}
              {selectedEntries.length > 0 && (
                <div className="space-y-3">
                  {selectedEntries.map((entry) => (
                    <div key={entry.id} className="flex items-start justify-between rounded-md border p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-tight">{entry.description}</p>
                        <p className="text-xs text-muted-foreground">{entry.member}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-normal">{entry.hours}h</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteEntry(entry.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-3 text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold">{selectedEntries.reduce((s, e) => s + e.hours, 0)}h</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
