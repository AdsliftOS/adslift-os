import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, FolderOpen, Upload, FileText, Video, Image, Folder, ArrowUpRight } from "lucide-react";

const DRIVE_URL = "https://drive.google.com/drive/folders/17YYCoMtigkdlvye3aHBQ0R7vRTcl9rvH";

export default function Files() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dateien</h1>
          <p className="text-sm text-muted-foreground">Skripte, Creatives und Dokumente — in Google Drive.</p>
        </div>
        <Button size="sm" asChild>
          <a href={DRIVE_URL} target="_blank" rel="noopener noreferrer">
            <Upload className="mr-2 h-4 w-4" />Datei hochladen
            <ExternalLink className="ml-1.5 h-3 w-3" />
          </a>
        </Button>
      </div>

      {/* Drive Link Card */}
      <a href={DRIVE_URL} target="_blank" rel="noopener noreferrer" className="block">
        <Card className="relative overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all group border-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent">
          <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-bl-full" />
          <CardContent className="p-6 flex items-center gap-5">
            <div className="h-14 w-14 rounded-2xl bg-blue-500/15 flex items-center justify-center shrink-0">
              <svg className="h-8 w-8" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.4 13.8z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.8h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-lg font-bold group-hover:text-primary transition-colors">Google Drive öffnen</div>
              <div className="text-sm text-muted-foreground">Alle Dateien, Skripte und Creatives an einem Ort</div>
            </div>
            <ArrowUpRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </CardContent>
        </Card>
      </a>

      {/* Category Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Skripte", desc: "Ad Copy, Hooks, Angles", icon: FileText, color: "bg-blue-500/15 text-blue-500" },
          { title: "Creatives", desc: "Bilder, Designs, Vorlagen", icon: Image, color: "bg-violet-500/15 text-violet-500" },
          { title: "Videos", desc: "UGC, Reels, Testimonials", icon: Video, color: "bg-pink-500/15 text-pink-500" },
          { title: "Dokumente", desc: "Verträge, Briefings, Reports", icon: Folder, color: "bg-amber-500/15 text-amber-500" },
        ].map((item) => (
          <a key={item.title} href={DRIVE_URL} target="_blank" rel="noopener noreferrer">
            <Card className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group h-full">
              <CardContent className="p-4">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-3 ${item.color}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="text-sm font-semibold group-hover:text-primary transition-colors">{item.title}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</div>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>

      {/* Info */}
      <Card className="bg-muted/30">
        <CardContent className="p-4 flex items-start gap-3">
          <FolderOpen className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium">Tipp</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Lege im Drive-Ordner Unterordner an (z.B. pro Kunde oder Projekt) für bessere Übersicht.
              Beide Accounts (Alex & Daniel) haben Zugriff auf alle Dateien.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
