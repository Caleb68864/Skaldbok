import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toastVariants = cva(
  "pointer-events-auto rounded-[var(--radius-md)] px-5 py-3 text-bg shadow-[var(--shadow-medium)] text-center text-[length:var(--size-md)] font-[family-name:var(--font-ui)] min-w-[200px] animate-in slide-in-from-top-2 fade-in-0 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-top-2 data-[state=closed]:fade-out-0",
  {
    variants: {
      variant: {
        default: "bg-surface text-text border border-border",
        success: "bg-success",
        destructive: "bg-danger",
        info: "bg-info",
        warning: "bg-warning",
        error: "bg-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface ToastProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toastVariants> {
  id: string;
  message: string;
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant, message, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(toastVariants({ variant, className }))}
        {...props}
      >
        {message}
      </div>
    );
  },
);
Toast.displayName = "Toast";

export { Toast, toastVariants };
