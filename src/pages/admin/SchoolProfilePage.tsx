import { useState } from "react";
import { useAdminMembership } from "@/hooks/useAdminMembership";
import { useSchoolProfile, type SchoolContact, type QuickLink, type ScheduleException } from "@/hooks/useSchoolProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowUp, ArrowDown, Loader2 } from "lucide-react";

export default function SchoolProfilePage() {
  const { schoolId } = useAdminMembership();
  const { profile, isLoading, updateProfile, isUpdating } = useSchoolProfile(schoolId);
  const { toast } = useToast();

  const [contacts, setContacts] = useState<SchoolContact[]>([]);
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([]);
  const [wedMinDay, setWedMinDay] = useState(false);
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Sync state from fetched profile
  if (profile && !initialized) {
    setContacts(profile.contacts);
    setQuickLinks(profile.quick_links);
    setWedMinDay(profile.bell_schedule_rules?.wednesdayMinimumDay ?? false);
    setExceptions(profile.bell_schedule_rules?.exceptions ?? []);
    setInitialized(true);
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const saveContacts = async () => {
    await updateProfile({ contacts });
    toast({ title: "Contacts saved" });
  };

  const saveBellRules = async () => {
    await updateProfile({
      bell_schedule_rules: { wednesdayMinimumDay: wedMinDay, exceptions },
    });
    toast({ title: "Bell schedule rules saved" });
  };

  const saveQuickLinks = async () => {
    await updateProfile({ quick_links: quickLinks });
    toast({ title: "Quick links saved" });
  };

  const addContact = () => {
    setContacts([...contacts, { label: "", name: "", phone: "", email: "", notes: "", sortOrder: contacts.length }]);
  };

  const updateContact = (i: number, field: keyof SchoolContact, value: string) => {
    const copy = [...contacts];
    (copy[i] as any)[field] = value;
    setContacts(copy);
  };

  const moveContact = (i: number, dir: -1 | 1) => {
    const copy = [...contacts];
    const j = i + dir;
    if (j < 0 || j >= copy.length) return;
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setContacts(copy);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">School Profile</h1>

      {/* Contacts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contacts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {contacts.map((c, i) => (
            <div key={i} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Contact #{i + 1}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveContact(i, -1)}><ArrowUp className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveContact(i, 1)}><ArrowDown className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setContacts(contacts.filter((_, j) => j !== i))}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Label</Label><Input value={c.label} onChange={(e) => updateContact(i, "label", e.target.value)} placeholder="e.g. Front Office" className="h-8 text-sm" /></div>
                <div><Label className="text-xs">Name</Label><Input value={c.name} onChange={(e) => updateContact(i, "name", e.target.value)} className="h-8 text-sm" /></div>
                <div><Label className="text-xs">Phone</Label><Input value={c.phone} onChange={(e) => updateContact(i, "phone", e.target.value)} className="h-8 text-sm" /></div>
                <div><Label className="text-xs">Email</Label><Input value={c.email} onChange={(e) => updateContact(i, "email", e.target.value)} className="h-8 text-sm" /></div>
              </div>
              <div><Label className="text-xs">Notes</Label><Input value={c.notes} onChange={(e) => updateContact(i, "notes", e.target.value)} className="h-8 text-sm" /></div>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addContact}><Plus className="w-3 h-3 mr-1" /> Add Contact</Button>
            <Button size="sm" onClick={saveContacts} disabled={isUpdating}>{isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save Contacts"}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Bell Schedule Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bell Schedule / Minimum Day Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={wedMinDay} onCheckedChange={setWedMinDay} />
            <Label>Wednesdays are Minimum Days</Label>
          </div>

          <div>
            <Label className="text-sm font-medium">Exceptions</Label>
            <div className="space-y-2 mt-2">
              {exceptions.map((ex, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input type="date" value={ex.date} onChange={(e) => { const copy = [...exceptions]; copy[i].date = e.target.value; setExceptions(copy); }} className="h-8 text-sm w-40" />
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={ex.isMinimumDay} onChange={(e) => { const copy = [...exceptions]; copy[i].isMinimumDay = e.target.checked; setExceptions(copy); }} />
                    Min Day
                  </label>
                  <Input value={ex.note} onChange={(e) => { const copy = [...exceptions]; copy[i].note = e.target.value; setExceptions(copy); }} placeholder="Note" className="h-8 text-sm flex-1" />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setExceptions(exceptions.filter((_, j) => j !== i))}><Trash2 className="w-3 h-3" /></Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setExceptions([...exceptions, { date: "", isMinimumDay: false, note: "" }])}><Plus className="w-3 h-3 mr-1" /> Add Exception</Button>
          </div>

          <Button size="sm" onClick={saveBellRules} disabled={isUpdating}>{isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save Rules"}</Button>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {quickLinks.map((ql, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={ql.label} onChange={(e) => { const copy = [...quickLinks]; copy[i].label = e.target.value; setQuickLinks(copy); }} placeholder="Label" className="h-8 text-sm" />
              <Input value={ql.url} onChange={(e) => { const copy = [...quickLinks]; copy[i].url = e.target.value; setQuickLinks(copy); }} placeholder="URL" className="h-8 text-sm flex-1" />
              <Input value={ql.category} onChange={(e) => { const copy = [...quickLinks]; copy[i].category = e.target.value; setQuickLinks(copy); }} placeholder="Category" className="h-8 text-sm w-24" />
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setQuickLinks(quickLinks.filter((_, j) => j !== i))}><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setQuickLinks([...quickLinks, { label: "", url: "", category: "", sortOrder: quickLinks.length }])}><Plus className="w-3 h-3 mr-1" /> Add Link</Button>
            <Button size="sm" onClick={saveQuickLinks} disabled={isUpdating}>{isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save Links"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
