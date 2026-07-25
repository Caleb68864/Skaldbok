import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Props for {@link SectionPanel}. `collapsible` enables the header toggle; `defaultOpen` sets the initial state. */
interface SectionPanelProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

/**
 * Bordered content panel with a gold-accented title header, optionally collapsible.
 *
 * @remarks
 * The collapse is a CSS grid-rows transition (`1fr`↔`0fr`) rather than conditional
 * mounting, so children stay mounted and keep their state while hidden and the
 * open/close animates. Open state is local; there is no persistence.
 */
export function SectionPanel({ title, subtitle, icon, children, collapsible = false, defaultOpen = true }: SectionPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-border rounded-[var(--radius-md)] mb-0 overflow-hidden flex flex-col h-full">
      <div
        className={cn(
          "flex items-center justify-between px-[var(--space-sm)] py-[var(--space-xs)]",
          "bg-gradient-to-r from-surface-alt to-surface border-b-2 border-b-gold",
          collapsible && "cursor-pointer min-h-[var(--touch-target-min)] focus-visible:outline-2 focus-visible:outline-gold",
          !open && "border-b-0",
        )}
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
        // Keyboard operability for the role="button" header: Enter/Space toggle,
        // Space preventDefault so it doesn't also scroll the page. Additive — the
        // non-collapsible path stays a plain, unfocusable div.
        onKeyDown={collapsible ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(o => !o);
          }
        } : undefined}
        tabIndex={collapsible ? 0 : undefined}
        role={collapsible ? 'button' : undefined}
        aria-expanded={collapsible ? open : undefined}
      >
        <h3 className="text-[length:var(--size-md)] font-[family-name:var(--font-display)] text-text font-bold flex items-center gap-[var(--space-xs)]">
          {icon && <span className="text-gold drop-shadow-sm">{icon}</span>}
          {title}
          {subtitle && (
            <span className="text-[length:0.7rem] font-normal text-text-muted ml-[var(--space-xs)] whitespace-nowrap">
              {subtitle}
            </span>
          )}
        </h3>
        {collapsible && (
          <span className="text-text-muted">
            {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </span>
        )}
      </div>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out flex-1 min-h-0"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="p-[var(--space-sm)] h-full">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
