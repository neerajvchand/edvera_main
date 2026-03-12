import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Calendar } from "lucide-react";
import { format, parseISO, isToday } from "date-fns";
import type { Announcement } from "@/hooks/useAdminAnnouncements";
import type { ComingUpEvent } from "@/hooks/useComingUp";

interface CommsSidebarProps {
  announcements: Announcement[];
  events: ComingUpEvent[];
}

export function CommsSidebar({ announcements, events }: CommsSidebarProps) {
  const sorted = [...announcements].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const drafts = sorted.filter((a) => a.status === "draft");
  const published = sorted.filter((a) => a.status === "published");
  const publishedCount = published.filter(
    (a) => !a.ends_at || new Date(a.ends_at) > new Date()
  ).length;
  const latestDraft = drafts[0] ?? null;
  const latestPublished = published[0] ?? null;

  const todayEvents = events.filter((e) => isToday(parseISO(e.start_time))).slice(0, 3);

  return (
    <Card className="border bg-card shadow-sm">
      <CardContent className="p-4 space-y-5">
        {/* Announcements */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Announcements</h3>
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2" asChild>
              <Link to="/admin/comms">
                <Plus className="w-3 h-3" /> New
              </Link>
            </Button>
          </div>

          {latestDraft ? (
            <>
              <div className="rounded-md border border-dashed border-[hsl(var(--status-warning-border))] bg-[hsl(var(--status-warning-bg))] p-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-foreground truncate">{latestDraft.title}</span>
                  <Badge variant="outline" className="text-[10px] h-5 bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))] border-[hsl(var(--status-warning-border))]">
                    Draft
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{latestDraft.body.slice(0, 60)}</p>
                <Link to="/admin/comms" className="text-xs text-primary hover:underline mt-1 inline-block">
                  Finish & Publish →
                </Link>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{publishedCount} active announcement{publishedCount !== 1 ? "s" : ""}</p>
            </>
          ) : latestPublished ? (
            <>
              <div className="rounded-md border border-border bg-secondary/30 p-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-foreground truncate">{latestPublished.title}</span>
                  <Badge variant="outline" className="text-[10px] h-5 bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                    Published
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(latestPublished.created_at), "MMM d")} · Sent to {latestPublished.audience === "all" ? "everyone" : latestPublished.audience}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{publishedCount} active announcement{publishedCount !== 1 ? "s" : ""}</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No announcements yet</p>
          )}
        </div>

        {/* Separator */}
        <div className="border-t border-border" />

        {/* Today at School */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Today at School</h3>
          {todayEvents.length === 0 ? (
            <div className="flex items-center gap-2 py-1">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Nothing scheduled today</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayEvents.map((evt) => (
                <div key={evt.id} className="flex items-start gap-2">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{evt.title}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(evt.start_time), "h:mm a")}
                      </span>
                      {evt.category && (
                        <Badge variant="outline" className="text-[10px] h-4 border-border">{evt.category}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link to="/admin/comms" className="text-xs text-primary hover:underline mt-2 inline-block">
            Full calendar →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
