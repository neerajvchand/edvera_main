import { useState } from "react";
import { useAdminMembership } from "@/hooks/useAdminMembership";
import { useAdminAnnouncements, type Announcement } from "@/hooks/useAdminAnnouncements";
import { useAdminSchoolEvents, type AdminSchoolEvent } from "@/hooks/useAdminSchoolEvents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function CommsPage() {
  const { schoolId } = useAdminMembership();
  const { announcements, isLoading: aLoading, upsert: upsertAnn, remove: removeAnn, isUpserting: aUpserting, isRemoving: aRemoving } = useAdminAnnouncements(schoolId);
  const { events, isLoading: eLoading, upsert: upsertEvent, remove: removeEvent, isUpserting: eUpserting, isRemoving: eRemoving } = useAdminSchoolEvents(schoolId);
  const { toast } = useToast();

  const [annModal, setAnnModal] = useState<Partial<Announcement> | null>(null);
  const [eventModal, setEventModal] = useState<Partial<AdminSchoolEvent> | null>(null);

  const saveAnnouncement = async () => {
    if (!annModal?.title || !annModal?.body) return;
    try {
      await upsertAnn(annModal as any);
      setAnnModal(null);
      toast({ title: annModal.id ? "Announcement updated" : "Announcement created" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const saveEvent = async () => {
    if (!eventModal?.title || !eventModal?.start_time) return;
    try {
      await upsertEvent(eventModal as any);
      setEventModal(null);
      toast({ title: eventModal.id ? "Event updated" : "Event created" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Communications</h1>

      <Tabs defaultValue="announcements">
        <TabsList>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        {/* ANNOUNCEMENTS TAB */}
        <TabsContent value="announcements" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{announcements.length} total</p>
            <Button size="sm" onClick={() => setAnnModal({ status: "published" })}><Plus className="w-3 h-3 mr-1" /> New Announcement</Button>
          </div>

          {aLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No announcements yet</p>
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => {
                const isExpired = a.ends_at && new Date(a.ends_at) < new Date();
                return (
                  <Card key={a.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-sm truncate">{a.title}</h3>
                            <Badge variant={a.status === "published" && !isExpired ? "default" : "secondary"} className="text-[10px]">
                              {isExpired ? "Expired" : a.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{a.body}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Starts: {format(new Date(a.starts_at), "MMM d, yyyy")}
                            {a.ends_at && ` · Ends: ${format(new Date(a.ends_at), "MMM d, yyyy")}`}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {!isExpired && a.status === "published" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Expire now" onClick={async () => {
                              await upsertAnn({ ...a, ends_at: new Date().toISOString() });
                              toast({ title: "Announcement expired" });
                            }}><Clock className="w-3 h-3" /></Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAnnModal(a)}><Pencil className="w-3 h-3" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="w-3 h-3" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete announcement?</AlertDialogTitle>
                                <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeAnn(a.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* EVENTS TAB */}
        <TabsContent value="events" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{events.length} events</p>
            <Button size="sm" onClick={() => setEventModal({})}><Plus className="w-3 h-3 mr-1" /> New Event</Button>
          </div>

          {eLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No events</p>
          ) : (
            <div className="space-y-3">
              {events.map((ev) => (
                <Card key={ev.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm">{ev.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(ev.start_time), "MMM d, yyyy h:mm a")}
                          {ev.location && ` · ${ev.location}`}
                        </p>
                        {ev.source !== "manual" && (
                          <Badge variant="outline" className="text-[10px] mt-1">{ev.source}</Badge>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEventModal(ev)}><Pencil className="w-3 h-3" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="w-3 h-3" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete event?</AlertDialogTitle>
                              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeEvent(ev.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Announcement Modal */}
      <Dialog open={!!annModal} onOpenChange={(open) => !open && setAnnModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{annModal?.id ? "Edit Announcement" : "New Announcement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={annModal?.title ?? ""} onChange={(e) => setAnnModal({ ...annModal, title: e.target.value })} /></div>
            <div><Label>Body</Label><Textarea value={annModal?.body ?? ""} onChange={(e) => setAnnModal({ ...annModal, body: e.target.value })} rows={4} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Starts At</Label><Input type="datetime-local" value={annModal?.starts_at ? format(new Date(annModal.starts_at), "yyyy-MM-dd'T'HH:mm") : ""} onChange={(e) => setAnnModal({ ...annModal, starts_at: new Date(e.target.value).toISOString() })} /></div>
              <div><Label>Ends At (optional)</Label><Input type="datetime-local" value={annModal?.ends_at ? format(new Date(annModal.ends_at), "yyyy-MM-dd'T'HH:mm") : ""} onChange={(e) => setAnnModal({ ...annModal, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={annModal?.status ?? "published"} onValueChange={(v) => setAnnModal({ ...annModal, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnModal(null)}>Cancel</Button>
            <Button onClick={saveAnnouncement} disabled={aUpserting}>{aUpserting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event Modal */}
      <Dialog open={!!eventModal} onOpenChange={(open) => !open && setEventModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{eventModal?.id ? "Edit Event" : "New Event"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={eventModal?.title ?? ""} onChange={(e) => setEventModal({ ...eventModal, title: e.target.value })} /></div>
            <div><Label>Location</Label><Input value={eventModal?.location ?? ""} onChange={(e) => setEventModal({ ...eventModal, location: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Starts</Label><Input type="datetime-local" value={eventModal?.start_time ? format(new Date(eventModal.start_time), "yyyy-MM-dd'T'HH:mm") : ""} onChange={(e) => setEventModal({ ...eventModal, start_time: new Date(e.target.value).toISOString() })} /></div>
              <div><Label>Ends (optional)</Label><Input type="datetime-local" value={eventModal?.end_time ? format(new Date(eventModal.end_time), "yyyy-MM-dd'T'HH:mm") : ""} onChange={(e) => setEventModal({ ...eventModal, end_time: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventModal(null)}>Cancel</Button>
            <Button onClick={saveEvent} disabled={eUpserting}>{eUpserting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
