import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] font-[family-name:var(--font-ui)] text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-60 min-h-[44px] min-w-[44px] cursor-pointer active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-bg border border-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] hover:brightness-110 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]",
        secondary:
          "bg-surface-alt text-text border border-border hover:brightness-110 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]",
        ghost:
          "bg-transparent text-text border-none hover:bg-surface-alt active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]",
        destructive:
          "bg-danger text-bg border border-danger hover:brightness-110 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]",
        outline:
          "bg-transparent text-text border border-border hover:bg-surface-alt active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]",
        icon:
          "bg-transparent text-text border border-border hover:bg-surface-alt active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] aspect-square p-2",
        gold:
          "bg-accent text-bg border-2 border-gold shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] hover:brightness-110 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]",
        /* Legacy aliases for backward compatibility */
        primary:
          "bg-accent text-bg border border-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] hover:brightness-110 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]",
        danger:
          "bg-danger text-bg border border-danger hover:brightness-110 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]",
      },
      size: {
        sm: "text-sm px-3 py-1.5 min-h-[44px]",
        md: "text-base px-4 py-2.5 min-h-[44px]",
        lg: "text-lg px-6 py-3.5 min-h-[52px]",
        icon: "p-2 min-h-[44px] min-w-[44px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
