import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface CorrectionConfirmDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function CorrectionConfirmDrawer({ open, onOpenChange, onConfirm }: CorrectionConfirmDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <div className="px-4 pb-6 pt-2">
          <DrawerHeader className="px-0">
            <DrawerTitle>Make a correction?</DrawerTitle>
            <DrawerDescription className="sr-only">Confirm correction</DrawerDescription>
          </DrawerHeader>

          <div className="flex items-start gap-3 rounded-lg bg-[hsl(var(--status-warning-bg))] border border-[hsl(var(--status-warning-border))] px-3.5 py-3 mb-5">
            <AlertCircle className="w-5 h-5 text-[hsl(var(--status-warning-text))] mt-0.5 shrink-0" />
            <p className="text-sm text-[hsl(var(--status-warning-text))]">
              The office already processed this. If you change it, we'll send an updated note for review.
            </p>
          </div>

          <div className="space-y-2">
            <Button className="w-full" onClick={() => { onOpenChange(false); onConfirm(); }}>
              Continue
            </Button>
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Keep as is
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
