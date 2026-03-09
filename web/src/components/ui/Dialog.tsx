import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Info, Trash2, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "./Button";

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
  );
}

function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, open: boolean) {
  useEffect(() => {
    if (!open || !containerRef.current) return;
    const el = containerRef.current;
    const focusable = getFocusableElements(el);
    if (focusable.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = getFocusableElements(el);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [open, containerRef]);
}

export type DialogBaseProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  titleId?: string;
  descriptionId?: string;
  onOverlayClick?: (() => void) | null;
  className?: string;
  /** Show a close (X) button in the top-right corner. */
  showCloseButton?: boolean;
};

export function Dialog({
  open,
  onClose,
  children,
  titleId,
  descriptionId,
  onOverlayClick = null,
  className,
  showCloseButton = false,
}: DialogBaseProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    previousActiveRef.current = document.activeElement as HTMLElement | null;
  }, [open]);

  const restoreFocus = useCallback(() => {
    if (previousActiveRef.current && typeof previousActiveRef.current.focus === "function") {
      previousActiveRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      restoreFocus();
    };
  }, [open, restoreFocus]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const focusable = getFocusableElements(panelRef.current);
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== e.currentTarget) return;
      if (onOverlayClick) onOverlayClick();
    },
    [onOverlayClick]
  );

  if (!open) return null;

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        className="dialog-overlay fixed inset-0 bg-black/40 backdrop-blur-sm"
        aria-hidden
        onClick={handleOverlayClick}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId || undefined}
        aria-describedby={descriptionId || undefined}
        className={cn(
          "dialog-panel relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl",
          className
        )}
        onKeyDown={handleKeyDown}
      >
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-muted transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        )}
        {children}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

export type DialogConfirmationProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  icon?: "warning" | "info" | "error" | "delete";
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: "default" | "danger";
};

const iconMap = {
  warning: AlertTriangle,
  info: Info,
  error: AlertTriangle,
  delete: Trash2,
};

const iconBgMap = {
  warning: "bg-warning/10 text-warning",
  info: "bg-primary/10 text-primary",
  error: "bg-error/10 text-error",
  delete: "bg-error/10 text-error",
};

function DialogConfirmation({
  open,
  onClose,
  title,
  message,
  icon = "warning",
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  variant = "default",
}: DialogConfirmationProps) {
  const titleId = useId();
  const descId = useId();
  const IconComponent = iconMap[icon];
  const iconBg = iconBgMap[icon];

  const handleCancel = () => {
    if (onCancel) onCancel();
    else onClose();
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      titleId={titleId}
      descriptionId={descId}
    >
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
              iconBg
            )}
          >
            <IconComponent className="h-6 w-6" aria-hidden strokeWidth={2} />
          </div>
          <h2 id={titleId} className="text-xl font-semibold text-gray-900">
            {title}
          </h2>
        </div>
        <p id={descId} className="text-sm leading-relaxed text-muted">
          {message}
        </p>
        <div className="flex flex-wrap justify-center gap-4 pt-1">
          <Button
            variant="secondary"
            onClick={handleCancel}
            className="rounded-xl px-5 py-2"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={handleConfirm}
            className="rounded-xl px-5 py-2"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export type DialogInformationProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  icon?: "info" | "warning" | "success";
  buttonLabel?: string;
};

const infoIconMap = {
  info: Info,
  success: Info,
  warning: AlertTriangle,
};

const infoIconBgMap = {
  info: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
};

function DialogInformation({
  open,
  onClose,
  title,
  message,
  icon = "info",
  buttonLabel = "OK",
}: DialogInformationProps) {
  const titleId = useId();
  const descId = useId();
  const IconComponent = infoIconMap[icon];
  const iconBg = infoIconBgMap[icon];

  return (
    <Dialog open={open} onClose={onClose} titleId={titleId} descriptionId={descId}>
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
              iconBg
            )}
          >
            <IconComponent className="h-6 w-6" aria-hidden strokeWidth={2} />
          </div>
          <h2 id={titleId} className="text-xl font-semibold text-gray-900">
            {title}
          </h2>
        </div>
        <p id={descId} className="text-sm leading-relaxed text-muted">
          {message}
        </p>
        <div className="flex justify-center pt-1">
          <Button variant="primary" onClick={onClose} className="rounded-xl px-5 py-2">
            {buttonLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export type DialogCustomProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  onOverlayClick?: (() => void) | null;
};

function DialogCustom({
  open,
  onClose,
  title,
  children,
  ariaLabelledBy,
  ariaDescribedBy,
  onOverlayClick = null,
}: DialogCustomProps) {
  const titleId = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      titleId={ariaLabelledBy || (title ? titleId : undefined)}
      descriptionId={ariaDescribedBy}
      onOverlayClick={onOverlayClick}
      showCloseButton
    >
      {title ? (
        <div className={cn("space-y-6", title && "pr-8")}>
          <h2 id={titleId} className="text-xl font-semibold text-gray-900">
            {title}
          </h2>
          <div className="text-sm text-gray-700">{children}</div>
        </div>
      ) : (
        <div className="pr-8">{children}</div>
      )}
    </Dialog>
  );
}

export const DialogComponents = {
  Dialog,
  Confirmation: DialogConfirmation,
  Information: DialogInformation,
  Custom: DialogCustom,
};

// Imperative API context
type ConfirmOptions = {
  title: string;
  message: string;
  icon?: "warning" | "info" | "error" | "delete";
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
};

type AlertOptions = {
  title: string;
  message: string;
  icon?: "info" | "warning" | "success";
};

type DialogContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
  openCustom: (options: {
    title?: string;
    content: ReactNode;
    onClose: () => void;
  }) => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmOptions & { id: number } | null>(null);
  const [alertState, setAlertState] = useState<AlertOptions & { id: number } | null>(null);
  const [customState, setCustomState] = useState<{
    title?: string;
    content: ReactNode;
    onClose: () => void;
  } | null>(null);
  const resolveConfirmRef = useRef<(value: boolean) => void>(() => {});
  const resolveAlertRef = useRef<() => void>(() => {});
  const nextIdRef = useRef(0);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveConfirmRef.current = resolve;
      setConfirmState({ ...options, id: nextIdRef.current++ });
    });
  }, []);

  const alert = useCallback((options: AlertOptions) => {
    return new Promise<void>((resolve) => {
      resolveAlertRef.current = resolve;
      setAlertState({ ...options, id: nextIdRef.current++ });
    });
  }, []);

  const openCustom = useCallback(
    (options: { title?: string; content: ReactNode; onClose: () => void }) => {
      setCustomState(options);
    },
    []
  );

  const handleConfirmClose = useCallback(() => {
    resolveConfirmRef.current(false);
    setConfirmState(null);
  }, []);

  const handleConfirmConfirm = useCallback(() => {
    resolveConfirmRef.current(true);
    setConfirmState(null);
  }, []);

  const handleAlertClose = useCallback(() => {
    resolveAlertRef.current();
    setAlertState(null);
  }, []);

  const handleCustomClose = useCallback(() => {
    customState?.onClose();
    setCustomState(null);
  }, [customState]);

  const value: DialogContextValue = {
    confirm,
    alert,
    openCustom,
  };

  return (
    <DialogContext.Provider value={value}>
      {children}
      {confirmState && (
        <DialogConfirmation
          key={confirmState.id}
          open
          onClose={handleConfirmClose}
          title={confirmState.title}
          message={confirmState.message}
          icon={confirmState.icon}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          variant={confirmState.variant}
          onConfirm={handleConfirmConfirm}
          onCancel={handleConfirmClose}
        />
      )}
      {alertState && (
        <DialogInformation
          key={alertState.id}
          open
          onClose={handleAlertClose}
          title={alertState.title}
          message={alertState.message}
          icon={alertState.icon}
          buttonLabel="OK"
        />
      )}
      {customState && (
        <DialogCustom
          open
          onClose={handleCustomClose}
          title={customState.title}
          onOverlayClick={handleCustomClose}
        >
          {customState.content}
        </DialogCustom>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return ctx;
}
