import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-xl border border-border bg-surface p-[var(--space-md)] transition-all duration-150 active:shadow-lg active:translate-y-[-1px]",
  {
    variants: {
      variant: {
        default: "shadow-sm hover:shadow-md",
        elevated: "shadow-md hover:shadow-lg",
        inset: "shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

/** Props for {@link Card}: native div attributes plus a `variant` from {@link cardVariants}. */
export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

/** Surface container with border and shadow; adds a pointer cursor automatically when an `onClick` is supplied. */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, onClick, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          cardVariants({ variant }),
          onClick && "cursor-pointer",
          className,
        )}
        onClick={onClick}
        {...props}
      />
    );
  },
);
Card.displayName = "Card";

export { Card, cardVariants };
