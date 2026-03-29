import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, Mail, MapPin, AlertTriangle, Heart, Apple, Building, ChevronDown, Check, LifeBuoy } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { contactsBySchool, type ContactEntry, type ContactCategory } from "@/data/contactsData";

const iconMap: Record<string, React.ReactNode> = {
  AlertTriangle: <AlertTriangle className="w-4 h-4" />,
  Heart: <Heart className="w-4 h-4" />,
  Apple: <Apple className="w-4 h-4" />,
  Building: <Building className="w-4 h-4" />,
};

const iconChipBg: Record<string, string> = {
  AlertTriangle: "bg-red-100 text-red-600",
  Heart: "bg-blue-100 text-blue-600",
  Apple: "bg-green-100 text-green-600",
  Building: "bg-purple-100 text-purple-600",
};

function ContactItem({ contact }: { contact: ContactEntry }) {
  const mapsUrl = contact.address
    ? `https://maps.google.com/?q=${encodeURIComponent(contact.address)}`
    : null;

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <p className="font-medium text-foreground text-sm">{contact.name}</p>
      {contact.role && (
        <p className="text-xs text-muted-foreground mt-0.5">{contact.role}</p>
      )}
      <div className="flex flex-wrap gap-2 mt-2">
        {contact.phone && (
          <a
            href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium min-h-[44px] hover:bg-primary/20 transition-colors"
            aria-label={`Call ${contact.name}`}
          >
            <Phone className="w-3.5 h-3.5" />
            {contact.phone}
          </a>
        )}
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-foreground text-xs font-medium min-h-[44px] hover:bg-secondary/60 transition-colors"
            aria-label={`Email ${contact.name}`}
          >
            <Mail className="w-3.5 h-3.5" />
            Email
          </a>
        )}
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-foreground text-xs font-medium min-h-[44px] hover:bg-secondary/60 transition-colors"
            aria-label={`Directions to ${contact.name}`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Directions
          </a>
        )}
      </div>
    </div>
  );
}

function CategorySection({ category }: { category: ContactCategory }) {
  return (
    <AccordionItem value={category.id} className="border-none">
      <div className={`border-l-4 ${category.accentColor} rounded-lg bg-card shadow-sm mb-3`}>
        <AccordionTrigger className="px-4 py-3 hover:no-underline [&[data-state=open]>svg]:rotate-180">
          <div className="flex items-center gap-2.5">
            <span className={`flex items-center justify-center w-7 h-7 rounded-full ${iconChipBg[category.icon] ?? "bg-muted text-muted-foreground"}`}>
              {iconMap[category.icon] ?? <LifeBuoy className="w-4 h-4" />}
            </span>
            <span className="font-semibold text-sm text-foreground">{category.label}</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="divide-y divide-border">
            {category.contacts.map((contact, i) => (
              <ContactItem key={i} contact={contact} />
            ))}
          </div>
        </AccordionContent>
      </div>
    </AccordionItem>
  );
}

export default function ContactsPage() {
  const navigate = useNavigate();
  const [selectedSchoolId, setSelectedSchoolId] = useState(contactsBySchool[0]?.school_id ?? "");

  const selectedSchool = contactsBySchool.find((s) => s.school_id === selectedSchoolId) ?? contactsBySchool[0];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold text-foreground flex-1 text-center">
            Contacts & Support
          </h1>
          {/* School selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors text-xs"
                aria-label="Select school"
              >
                <Building className="w-4 h-4" />
                <ChevronDown className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-popover border border-border shadow-md z-50">
              {contactsBySchool.map((school) => (
                <DropdownMenuItem
                  key={school.school_id}
                  onClick={() => setSelectedSchoolId(school.school_id)}
                  className="cursor-pointer flex items-center justify-between"
                >
                  <span className="text-sm">{school.school_name}</span>
                  {school.school_id === selectedSchoolId && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* School context banner */}
      <div className="max-w-md mx-auto w-full px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building className="w-4 h-4" />
          <span className="font-medium text-foreground">{selectedSchool.school_name}</span>
        </div>
      </div>

      {/* Accordion sections */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 pb-8">
        <Accordion type="single" collapsible defaultValue="urgent">
          {selectedSchool.categories.map((cat) => (
            <CategorySection key={cat.id} category={cat} />
          ))}
        </Accordion>
      </main>

      {/* Safe bottom padding */}
      <div className="h-6" />
    </div>
  );
}
