import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

type ToastKind = "success" | "error";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const value: ToastContextValue = {
    success: (message) => push("success", message),
    error: (message) => push("error", message),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`flex items-start gap-2.5 rounded-md border px-3.5 py-3 shadow-card bg-white animate-in ${
              t.kind === "success" ? "border-status-approved/30" : "border-status-overdue/30"
            }`}
          >
            {t.kind === "success" ? (
              <CheckCircle2 size={18} className="text-status-approved mt-0.5 shrink-0" />
            ) : (
              <XCircle size={18} className="text-status-overdue mt-0.5 shrink-0" />
            )}
            <p className="text-sm text-ink flex-1 leading-snug">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-ink-faint hover:text-ink shrink-0"
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
