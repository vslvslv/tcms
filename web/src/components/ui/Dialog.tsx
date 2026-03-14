import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, Info, Trash2 } from "lucide-react";
import { Button } from "./Button";
import {
  Dialog as DialogRoot,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./dialog-primitive";
import { cn } from "@/lib/utils";

export type DialogBaseProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  titleId?: string;
  descriptionId?: string;
  onOverlayClick?: (() => void) | null;
  className?: string;
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
  return (
    <DialogRoot open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={showCloseButton}
        onClose={onClose}
        onOverlayClick={onOverlayClick ?? undefined}
        className={cn("max-w-md", className)}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        {children}
      </DialogContent>
    </DialogRoot>
  );
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
    <DialogRoot open={open} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent onClose={handleCancel} className="max-w-md" aria-labelledby={titleId} aria-describedby={descId}>
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", iconBg)}>
              <IconComponent className="h-6 w-6" aria-hidden strokeWidth={2} />
            </div>
            <DialogTitle id={titleId} className="text-xl font-semibold text-foreground">
              {title}
            </DialogTitle>
          </div>
          <DialogDescription id={descId} className="text-sm leading-relaxed text-muted-foreground">
            {message}
          </DialogDescription>
          <div className="flex flex-wrap justify-center gap-4 pt-1">
            <Button variant="secondary" onClick={handleCancel} className="rounded-xl px-5 py-2">
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
      </DialogContent>
    </DialogRoot>
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
    <DialogRoot open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent onClose={onClose} className="max-w-md" aria-labelledby={titleId} aria-describedby={descId}>
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", iconBg)}>
              <IconComponent className="h-6 w-6" aria-hidden strokeWidth={2} />
            </div>
            <DialogTitle id={titleId} className="text-xl font-semibold text-foreground">
              {title}
            </DialogTitle>
          </div>
          <DialogDescription id={descId} className="text-sm leading-relaxed text-muted-foreground">
            {message}
          </DialogDescription>
          <div className="flex justify-center pt-1">
            <Button variant="primary" onClick={onClose} className="rounded-xl px-5 py-2">
              {buttonLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
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
    <DialogRoot open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton
        onClose={onClose}
        onOverlayClick={onOverlayClick ?? undefined}
        className="max-w-md"
        aria-labelledby={ariaLabelledBy || (title ? titleId : undefined)}
        aria-describedby={ariaDescribedBy}
      >
        {title ? (
          <div className={cn("space-y-6", title && "pr-8")}>
            <DialogTitle id={titleId} className="text-xl font-semibold text-foreground">
              {title}
            </DialogTitle>
            <div className="text-sm text-muted-foreground">{children}</div>
          </div>
        ) : (
          <div className="pr-8">{children}</div>
        )}
      </DialogContent>
    </DialogRoot>
  );
}

export const DialogComponents = {
  Dialog,
  Confirmation: DialogConfirmation,
  Information: DialogInformation,
  Custom: DialogCustom,
};

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
  openCustom: (options: { title?: string; content: ReactNode; onClose: () => void }) => void;
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

  const openCustom = useCallback((options: { title?: string; content: ReactNode; onClose: () => void }) => {
    setCustomState(options);
  }, []);

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
