import { LifeBuoy, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";

export function QuickHelpCard() {
  const navigate = useNavigate();

  return (
    <Card
      className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
      onClick={() => navigate("/contacts")}
      role="button"
      tabIndex={0}
      aria-label="Quick Help & Contacts"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate("/contacts");
        }
      }}
    >
      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-secondary text-muted-foreground shrink-0">
        <LifeBuoy className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground">Quick Help & Contacts</p>
        <p className="text-xs text-muted-foreground">Get the right person fast.</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </Card>
  );
}
