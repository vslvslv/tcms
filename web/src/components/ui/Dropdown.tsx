import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      className={cn("h-4 w-4 shrink-0 text-muted transition-transform duration-200", open && "rotate-180")}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
    </svg>
  );
}

const triggerClasses = [
  "inline-flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm font-medium text-gray-700",
  "transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm",
  "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:shadow-md",
  "disabled:pointer-events-none disabled:opacity-60",
].join(" ");

const panelClasses = [
  "dropdown-panel absolute top-full z-20 mt-2 list-none overflow-hidden rounded-xl border border-border bg-surface py-1.5 shadow-xl",
].join(" ");

const itemClasses = [
  "w-full cursor-pointer border-none bg-transparent px-3 py-2.5 text-left text-sm text-gray-700 transition-colors duration-150",
  "hover:bg-gray-100 first:mt-0 last:mb-0",
].join(" ");

type DropdownProps = {
  /** Trigger content (e.g. button label). */
  trigger: ReactNode;
  /** Panel content. Use Dropdown.Item for menu items. */
  children: ReactNode;
  /** Align panel to left or right of trigger. */
  align?: "left" | "right";
  /** Optional class for the panel. */
  panelClassName?: string;
  /** Max height class for scrollable panel (e.g. "max-h-72"). */
  panelMaxHeight?: string;
  /** Whether the dropdown is open (controlled). */
  open?: boolean;
  /** Called when open state should change (e.g. close on select). */
  onOpenChange?: (open: boolean) => void;
  /** Disable the trigger. */
  disabled?: boolean;
  /** aria-haspopup value for trigger. */
  "aria-haspopup"?: "true" | "menu" | "listbox";
  /** Extra class for the trigger button. */
  triggerClassName?: string;
  /** Hide the chevron icon in the trigger. */
  hideChevron?: boolean;
};

export function Dropdown({
  trigger,
  children,
  align = "left",
  panelClassName,
  panelMaxHeight,
  open: controlledOpen,
  onOpenChange,
  disabled = false,
  "aria-haspopup": ariaHaspopup = "true",
  triggerClassName,
  hideChevron = false,
}: DropdownProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (!isControlled) setInternalOpen(value);
    onOpenChange?.(value);
  };

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        aria-haspopup={ariaHaspopup}
        aria-expanded={open}
        className={cn(triggerClasses, triggerClassName)}
      >
        <span className="min-w-0 truncate">{trigger}</span>
        {!hideChevron && <ChevronDown open={open} />}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10 bg-black/5 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <ul
            role={ariaHaspopup === "listbox" ? "listbox" : "menu"}
            className={cn(
              panelClasses,
              align === "right" && "right-0 left-auto min-w-[140px]",
              align === "left" && "left-0 min-w-[180px]",
              panelMaxHeight && "overflow-y-auto",
              panelMaxHeight,
              panelClassName
            )}
          >
            {children}
          </ul>
        </>
      )}
    </div>
  );
}

type DropdownItemProps = {
  children: ReactNode;
  onClick?: () => void;
  role?: "menuitem" | "option";
  className?: string;
  /** Highlight as selected (e.g. for listbox). */
  selected?: boolean;
};

export function DropdownItem({
  children,
  onClick,
  role = "menuitem",
  className,
  selected,
}: DropdownItemProps) {
  return (
    <li role={role === "option" ? "option" : "none"} className="list-none">
      <button
        type="button"
        role={role}
        onClick={onClick}
        className={cn(
          itemClasses,
          "mx-1.5 rounded-lg",
          selected && "bg-primary/10 font-medium text-primary",
          className
        )}
      >
        {children}
      </button>
    </li>
  );
}
