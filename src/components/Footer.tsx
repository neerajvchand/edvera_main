import { getCurrentTime } from "@/lib/dateUtils";

interface FooterProps {
  lastUpdated: string;
}

export function Footer({ lastUpdated }: FooterProps) {
  return (
    <footer className="py-6 px-5 text-center">
      <p className="text-xs text-muted-foreground/70">
        Last updated: {lastUpdated}
      </p>
      <p className="text-xs text-muted-foreground/50 mt-1">
        Pull down to refresh
      </p>
    </footer>
  );
}
