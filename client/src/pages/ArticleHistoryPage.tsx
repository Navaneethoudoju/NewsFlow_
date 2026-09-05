import { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FilePlus2, Repeat, MessageSquare, BellOff, ArrowRight } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusStamp from "../components/StatusStamp";
import { LoadingState, ErrorState, EmptyState } from "../components/States";
import { useArticle, useArticleHistory } from "../hooks/useArticles";
import { formatDateTime, formatRelative } from "../lib/format";
import { ArticleEvent, EventType } from "../types";

const EVENT_ICON: Record<EventType, ReactNode> = {
  STATUS_CHANGE: <ArrowRight size={15} />,
  REVISION_OPENED: <FilePlus2 size={15} />,
  REVISION_PUBLISHED: <Repeat size={15} />,
  COMMENT: <MessageSquare size={15} />,
  ALERT_DISMISSED: <BellOff size={15} />,
};

function eventLabel(e: ArticleEvent): string {
  switch (e.type) {
    case "STATUS_CHANGE":
      return e.oldStatus ? `Status changed` : "Article created";
    case "REVISION_OPENED":
      return "Revision opened";
    case "REVISION_PUBLISHED":
      return "Revision published";
    case "COMMENT":
      return "Comment added";
    case "ALERT_DISMISSED":
      return "Overdue alert dismissed";
    default:
      return e.type;
  }
}

export default function ArticleHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const { data: article, isLoading: loadingArticle, isError: articleError } = useArticle(id);
  const { data: events, isLoading: loadingEvents, isError: eventsError } = useArticleHistory(id);

  if (loadingArticle || loadingEvents) return <LoadingState label="Loading history…" />;
  if (articleError || eventsError || !article) return <ErrorState message="This article's history could not be loaded." />;

  return (
    <div>
      <Link to={`/articles/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink">
        <ArrowLeft size={14} /> Back to article
      </Link>

      <PageHeader
        title={`History — ${article.title}`}
        description="An immutable audit trail. Nothing here can be edited or deleted."
      />

      {!events?.length ? (
        <EmptyState title="No history yet" description="Actions taken on this article will appear here." />
      ) : (
        <ol className="relative border-l border-rule pl-6">
          {events.map((e) => (
            <li key={e.id} className="mb-6 last:mb-0">
              <span className="absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full border border-rule bg-white text-ink-light">
                {EVENT_ICON[e.type]}
              </span>
              <div className="rounded-lg border border-rule bg-white p-3.5 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{eventLabel(e)}</p>
                  <span className="text-xs text-ink-faint" title={formatDateTime(e.createdAt)}>
                    {formatRelative(e.createdAt)}
                  </span>
                </div>
                {e.oldStatus && e.newStatus && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <StatusStamp status={e.oldStatus} />
                    <ArrowRight size={13} className="text-ink-faint" />
                    <StatusStamp status={e.newStatus} />
                  </div>
                )}
                {!e.oldStatus && e.newStatus && (
                  <div className="mt-2 text-sm">
                    <StatusStamp status={e.newStatus} />
                  </div>
                )}
                {e.message && <p className="mt-2 text-sm text-ink-light">{e.message}</p>}
                <p className="mt-2 text-xs text-ink-faint">by {e.actor.name}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
