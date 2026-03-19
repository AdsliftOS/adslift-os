import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, FolderOpen, Upload, FileText, Video, Image, Folder } from "lucide-react";

const DRIVE_FOLDER_ID = "17YYCoMtigkdlvye3aHBQ0R7vRTcl9rvH";
const DRIVE_URL = `https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}`;
const EMBED_URL = `https://drive.google.com/embeddedfolderview?id=${DRIVE_FOLDER_ID}#grid`;

export default function Files() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dateien</h1>
          <p className="text-sm text-muted-foreground">Skripte, Creatives und Dokumente — direkt aus Google Drive.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={DRIVE_URL} target="_blank" rel="noopener noreferrer">
              <FolderOpen className="mr-2 h-4 w-4" />In Drive öffnen
              <ExternalLink className="ml-1.5 h-3 w-3" />
            </a>
          </Button>
          <Button size="sm" asChild>
            <a href={DRIVE_URL} target="_blank" rel="noopener noreferrer">
              <Upload className="mr-2 h-4 w-4" />Hochladen
            </a>
          </Button>
        </div>
      </div>

      {/* Quick Info */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { title: "Skripte", desc: "Ad Copy, Hooks, Angles", icon: FileText, color: "bg-blue-500/15 text-blue-500" },
          { title: "Creatives", desc: "Bilder, Designs, Vorlagen", icon: Image, color: "bg-violet-500/15 text-violet-500" },
          { title: "Videos", desc: "UGC, Reels, Testimonials", icon: Video, color: "bg-pink-500/15 text-pink-500" },
          { title: "Dokumente", desc: "Verträge, Briefings, Reports", icon: Folder, color: "bg-amber-500/15 text-amber-500" },
        ].map((item) => (
          <Card key={item.title} className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all" onClick={() => window.open(DRIVE_URL, "_blank")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold">{item.title}</div>
                <div className="text-[10px] text-muted-foreground">{item.desc}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Embedded Drive */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            Google Drive
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <iframe
            src={EMBED_URL}
            className="w-full border-0"
            style={{ height: "calc(100vh - 320px)", minHeight: "500px" }}
            title="Google Drive"
          />
        </CardContent>
      </Card>
    </div>
  );
}
