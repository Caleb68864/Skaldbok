import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";

/** Props for {@link Modal}. `actions` render in the footer; omit them for a body-only dialog. */
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}

/** Convenience wrapper over the {@link Dialog} primitive: a titled modal with optional footer actions and an accessible hidden description. */
export function Modal({ open, onClose, title, children, actions }: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {/* Hidden description for accessibility */}
        <DialogDescription className="sr-only">{title}</DialogDescription>
        <DialogBody>{children}</DialogBody>
        {actions && <DialogFooter>{actions}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
