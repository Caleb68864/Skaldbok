import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetTitle,
  SheetDescription,
  SheetCloseButton,
} from "../ui/sheet";

/** Props for {@link Drawer}. `onClose` fires whenever the underlying sheet requests dismissal. */
export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Convenience wrapper over the {@link Sheet} primitive: a titled slide-in panel with an accessible hidden description. */
export function Drawer({ open, onClose, title, children }: DrawerProps) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetCloseButton />
        </SheetHeader>
        {/* Hidden description for accessibility */}
        <SheetDescription className="sr-only">{title}</SheetDescription>
        <SheetBody>{children}</SheetBody>
      </SheetContent>
    </Sheet>
  );
}
