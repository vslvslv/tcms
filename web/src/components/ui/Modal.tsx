import { useEffect, useRef } from "react";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (isOpen) {
      if (!el.open) el.showModal();
    } else {
      if (el.open) el.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    function onDialogClose() { onClose(); }
    el.addEventListener("close", onDialogClose);
    return () => el.removeEventListener("close", onDialogClose);
  }, [onClose]);

  // Close on backdrop click
  function handleClick(e: React.MouseEvent<HTMLDialogElement>) {
    const rect = dialogRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (
      e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom
    ) {
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleClick}
      className="m-auto w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-lg backdrop:bg-black/50 open:flex open:flex-col"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        {title && <h2 className="text-lg font-semibold text-text font-mono">{title}</h2>}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded p-1 text-muted hover:bg-surface-raised hover:text-text"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </dialog>
  );
}
