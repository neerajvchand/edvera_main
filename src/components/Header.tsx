import { Settings } from "lucide-react";
import { Child, School } from "@/types/schoolpulse";

interface HeaderProps {
  child: Child;
  school: School;
  onSettingsClick: () => void;
}

export function Header({ child, onSettingsClick }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-5 py-4">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Edvera
          </h1>
          <p className="text-sm text-muted-foreground">{child.name}</p>
        </div>
        <button
          onClick={onSettingsClick}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
