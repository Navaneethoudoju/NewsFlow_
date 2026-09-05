import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  Send,
  Undo2,
  CheckCircle2,
  CalendarClock,
  Rss,
  Ban,
  FilePlus2,
  History,
  Layers,
  Send as SendIcon,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import Button from "../components/Button";
import StatusStamp from "../components/StatusStamp";
import { ConfirmDialog, Modal } from "../components/Modal";
import { ErrorState, LoadingState } from "../components/States";
import { useAuth } from "../lib/AuthContext";
import {
  useArticle,
  useTransitionArticle,
  useCreateRevision,
  useComments,
  useAddComment,
} from "../hooks/useArticles";
import { useToast } from "../lib/ToastContext";
import { ApiError } from "../lib/api";
import { formatDateTime, formatRelative } from "../lib/format";
import { TransitionAction } from "../types";

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const isEditor = user?.role === "EDITOR";

  const { data: article, isLoading, isError } = useArticle(id);
  const { data: comments } = useComments(id);
  const transition = useTransitionArticle(id!);
  const createRevision = useCreateRevision();
  const addComment = useAddComment(id!);

  const [confirmAction, setConfirmAction] = useState<TransitionAction | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [commentText, setCommentText] = useState("");

  if (isLoading) return <LoadingState label="Loading article…" />;
  if (isError || !article) return <ErrorState message="This article could not be loaded." />;
  const articleId = article.id;
  const isAuthor = user?.id === article.authorId;
  const isOwnDraft = isAuthor && article.status === "DRAFT";
  const isOverdue = article.status === "SCHEDULED" && !!article.publishAt && new Date(article.publishAt) < new Date();

  const canEdit =
    article.status !== "PUBLISHED" && (isEditor || (isAuthor && article.status === "DRAFT"));

  const approvalBlocked = isAuthor && !isEditor === false && isAuthor; // author can never approve own article

  async function runTransition(action: TransitionAction, publishAt?: string) {
    try {
      await transition.mutateAsync({ action, publishAt });
      toast.success(`Article ${action.replace(/_/g, " ").toLowerCase()}d successfully.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That action could not be completed.");
    } finally {
      setConfirmAction(null);
      setScheduleOpen(false);
      setScheduleAt("");
    }
  }

  async function handleCreateRevision() {
    try {
const revision = await createRevision.mutateAsync(articleId);      toast.success("Revision created as a draft.");
      navigate(`/articles/${revision.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create a revision.");
    }
  }

  async function handleAddComment() {
    if (!commentText.trim()) return;
    try {
      await addComment.mutateAsync(commentText.trim());
      setCommentText("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not post the comment.");
    }
  }

  const ACTION_LABEL: Record<TransitionAction, string> = {
    SUBMIT_FOR_REVIEW: "Submit for review",
    SEND_BACK_TO_DRAFT: "Send back to draft",
    APPROVE: "Approve",
    SCHEDULE: "Schedule",
    PUBLISH: "Publish",
    UNSCHEDULE: "Unschedule",
    UNPUBLISH: "Unpublish",
  };

  return (
    <div>
      <Link to="/articles" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink">
        <ArrowLeft size={14} /> All articles
      </Link>

      <PageHeader
        title={article.title}
        actions={
          <>
            {canEdit && (
              <Link to={`/articles/${article.id}/edit`}>
                <Button variant="secondary">
                  <Pencil size={14} /> Edit
                </Button>
              </Link>
            )}
            <Link to={`/articles/${article.id}/history`}>
              <Button variant="secondary">
                <History size={14} /> History
              </Button>
            </Link>
            {!article.revisionOfId && (
              <Link to={`/articles/${article.id}/revisions`}>
                <Button variant="secondary">
                  <Layers size={14} /> Revisions
                </Button>
              </Link>
            )}
          </>
        }
      />

      {article.revisionOfId && (
        <div className="mb-4 rounded-md border border-status-scheduled/25 bg-status-scheduled/5 px-3.5 py-2 text-sm text-ink">
          This is a draft revision of{" "}
          <Link to={`/articles/${article.revisionOfId}`} className="font-medium text-masthead hover:underline">
            the live published article
          </Link>
          . Publishing it will replace the live content.
        </div>
      )}

      <div className="rounded-lg border border-rule bg-white shadow-card">
        <div className="grid grid-cols-2 gap-4 border-b border-rule p-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint font-mono">Status</p>
            <div className="mt-1">
              <StatusStamp status={article.status} overdue={isOverdue} />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint font-mono">Author</p>
            <p className="mt-1 text-ink">{article.author.name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint font-mono">Section</p>
            <p className="mt-1 text-ink">{article.section.name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint font-mono">Publish time</p>
            <p className="mt-1 text-ink">{formatDateTime(article.publishAt ?? article.publishedAt)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint font-mono">Created</p>
            <p className="mt-1 text-ink">{formatDateTime(article.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint font-mono">Updated</p>
            <p className="mt-1 text-ink">{formatDateTime(article.updatedAt)}</p>
          </div>
        </div>

        <div className="p-5">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{article.body}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-rule bg-paper-dim/40 p-4">
          {article.status === "DRAFT" && (isOwnDraft || isEditor) && (
            <Button size="sm" onClick={() => runTransition("SUBMIT_FOR_REVIEW")} loading={transition.isPending}>
              <Send size={14} /> Submit for review
            </Button>
          )}

          {isEditor && article.status === "IN_REVIEW" && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setConfirmAction("SEND_BACK_TO_DRAFT")}>
                <Undo2 size={14} /> Send back to draft
              </Button>
              <Button
                size="sm"
                onClick={() => (isAuthor ? toast.error("An editor other than the author must approve this article.") : setConfirmAction("APPROVE"))}
              >
                <CheckCircle2 size={14} /> Approve
              </Button>
            </>
          )}

          {isEditor && article.status === "APPROVED" && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setScheduleOpen(true)}>
                <CalendarClock size={14} /> Schedule
              </Button>
              <Button
                size="sm"
                onClick={() => (isAuthor ? toast.error("An editor other than the author must publish this article.") : setConfirmAction("PUBLISH"))}
              >
                <Rss size={14} /> Publish
              </Button>
            </>
          )}

          {isEditor && article.status === "SCHEDULED" && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setConfirmAction("UNSCHEDULE")}>
                <Undo2 size={14} /> Unschedule
              </Button>
              <Button
                size="sm"
                onClick={() => (isAuthor ? toast.error("An editor other than the author must publish this article.") : setConfirmAction("PUBLISH"))}
              >
                <Rss size={14} /> Publish now
              </Button>
            </>
          )}

          {isEditor && article.status === "PUBLISHED" && (
            <Button size="sm" variant="danger" onClick={() => setConfirmAction("UNPUBLISH")}>
              <Ban size={14} /> Unpublish
            </Button>
          )}

          {article.status === "PUBLISHED" && !article.revisionOfId && (
            <Button size="sm" variant="secondary" onClick={handleCreateRevision} loading={createRevision.isPending}>
              <FilePlus2 size={14} /> Create revision
            </Button>
          )}
        </div>
      </div>

      {/* Comments */}
      <div className="mt-6 rounded-lg border border-rule bg-white shadow-card">
        <div className="border-b border-rule px-4 py-3">
          <h3 className="font-serif text-base font-semibold text-ink">Comments</h3>
        </div>
        <ul className="divide-y divide-rule">
          {(comments ?? []).map((c) => (
            <li key={c.id} className="px-4 py-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-ink">{c.author.name}</span>
                <span className="text-xs text-ink-faint">{formatRelative(c.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm text-ink-light whitespace-pre-wrap">{c.content}</p>
            </li>
          ))}
          {!comments?.length && <li className="px-4 py-6 text-center text-sm text-ink-faint">No comments yet.</li>}
        </ul>
        <div className="flex gap-2 border-t border-rule p-3">
          <input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
            placeholder="Add a comment…"
            className="flex-1 rounded-md border border-rule bg-paper px-3 py-2 text-sm focus:border-masthead focus:outline-none"
          />
          <Button size="sm" onClick={handleAddComment} loading={addComment.isPending}>
            <SendIcon size={14} />
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmAction === "SEND_BACK_TO_DRAFT"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => runTransition("SEND_BACK_TO_DRAFT")}
        title="Send back to draft"
        description="The writer will need to resubmit this article for review."
        confirmLabel="Send back"
        loading={transition.isPending}
      />
      <ConfirmDialog
        open={confirmAction === "APPROVE"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => runTransition("APPROVE")}
        title="Approve article"
        description="This article will be ready to schedule or publish."
        confirmLabel="Approve"
        loading={transition.isPending}
      />
      <ConfirmDialog
        open={confirmAction === "PUBLISH"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => runTransition("PUBLISH")}
        title="Publish article"
        description={
          article.revisionOfId
            ? "This will replace the live article's content immediately."
            : "This article will go live immediately."
        }
        confirmLabel="Publish"
        loading={transition.isPending}
      />
      <ConfirmDialog
        open={confirmAction === "UNSCHEDULE"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => runTransition("UNSCHEDULE")}
        title="Unschedule article"
        description="This article will move back to Approved and will not publish automatically."
        confirmLabel="Unschedule"
        loading={transition.isPending}
      />
      <ConfirmDialog
        open={confirmAction === "UNPUBLISH"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => runTransition("UNPUBLISH")}
        title="Unpublish article"
        description="This article will be removed from public view and moved back to Approved."
        confirmLabel="Unpublish"
        danger
        loading={transition.isPending}
      />

      <Modal open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="Schedule publication">
        <label className="block text-sm font-medium text-ink-light">Publish date &amp; time</label>
        <input
          type="datetime-local"
          value={scheduleAt}
          onChange={(e) => setScheduleAt(e.target.value)}
          className="mt-1 w-full rounded-md border border-rule px-3 py-2 text-sm focus:border-masthead focus:outline-none"
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setScheduleOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => runTransition("SCHEDULE", new Date(scheduleAt).toISOString())}
            loading={transition.isPending}
            disabled={!scheduleAt}
          >
            Schedule
          </Button>
        </div>
      </Modal>
    </div>
  );
}
