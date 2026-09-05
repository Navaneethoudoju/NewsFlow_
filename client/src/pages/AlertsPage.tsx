import { Link } from "react-router-dom";
import { BellOff, AlertTriangle } from "lucide-react";
import PageHeader from "../components/PageHeader";
import Button from "../components/Button";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { useAlerts, useDismissAlert } from "../hooks/useDashboard";
import { useToast } from "../lib/ToastContext";
import { ApiError } from "../lib/api";
import { formatDateTime, formatDuration } from "../lib/format";

export default function AlertsPage() {
  const { data, isLoading, isError } = useAlerts();
  const dismiss = useDismissAlert();
  const toast = useToast();

  async function handleDismiss(articleId: string) {
    try {
      await dismiss.mutateAsync(articleId);
      toast.success("Alert dismissed.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not dismiss the alert.");
    }
  }

  if (isLoading) return <LoadingState label="Loading alerts…" />;
  if (isError || !data) return <ErrorState message="Alerts could not be loaded." />;

  return (
    <div>
      <PageHeader
        title="Overdue publish alerts"
        description="Scheduled articles whose publish time has passed without going live. Rescheduling to a new time that also passes will alert again."
      />

      {!data.alerts.length ? (
        <EmptyState
          icon={<BellOff size={28} strokeWidth={1.5} />}
          title="No overdue articles"
          description="Everything scheduled is on track."
        />
      ) : (
        <ul className="space-y-3">
          {data.alerts.map((a) => (
            <li
              key={a.articleId}
              className="flex flex-col gap-3 rounded-lg border border-status-overdue/25 bg-status-overdue/5 p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-status-overdue" />
                <div>
                  <Link to={`/articles/${a.articleId}`} className="font-medium text-ink hover:underline">
                    {a.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {a.section.name} · {a.author.name}
                  </p>
                  <p className="mt-1 text-sm text-status-overdue">
                    Was due {formatDateTime(a.scheduledAt)} — overdue by {formatDuration(a.overdueMs)}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleDismiss(a.articleId)}
                loading={dismiss.isPending}
              >
                <BellOff size={13} /> Dismiss
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
