export type ToastTone = "success" | "error" | "info";

const TONE_STYLES: Record<ToastTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-700",
  info: "border-stone-200 bg-white text-stone-700",
};

/**
 * The one status toast. Every page used to hand-roll a fixed-position div in
 * the bottom-right with its own colours and its own setTimeout; this keeps
 * them consistent and dismissible.
 */
export function Toast({
  message,
  tone = "success",
  onDismiss,
}: {
  message: string | null;
  tone?: ToastTone;
  onDismiss?: () => void;
}) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-lg border p-4 text-sm shadow-lg ${TONE_STYLES[tone]}`}
    >
      <span className="min-w-0 flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 opacity-50 hover:opacity-100"
        >
          ✕
        </button>
      )}
    </div>
  );
}
