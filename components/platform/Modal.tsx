"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./Icon";

export function Modal({
  children,
  title,
  onClose,
  wide = false,
  closeLabel = "Закрыть",
}: {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
  wide?: boolean;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`pf-modal ${wide ? "pf-modal-wide" : ""}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        className="pf-icon-button pf-modal-close"
        aria-label={closeLabel}
        onClick={onClose}
      >
        <Icon name="close" />
      </button>
      {children}
    </dialog>
  );
}
