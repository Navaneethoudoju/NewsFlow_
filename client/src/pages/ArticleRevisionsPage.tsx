import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FilePlus2, ArrowRight } from "lucide-react";
import PageHeader from "../components/PageHeader";
import Button from "../components/Button";
import StatusStamp from "../components/StatusStamp";
import { LoadingState, ErrorState, EmptyState } from "../components/States";
import { useArticle, useRevisions, useCreateRevision } from "../hooks/useArticles";
import { useToast } from "../lib/ToastContext";
import { ApiError } from "../lib/api";
import { formatDateTime } from "../lib/format";

export default function ArticleRevisionsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: article, isLoading: loadingArticle, isError: articleError } = useArticle(id);
  const { data: revisions, isLoading: loadingRevisions, isError: revisionsError } = useRevisions(id);
  const createRevision = useCreateRevision();

  if (loadingArticle || loadingRevisions) return <LoadingState label="Loading revisions…" />;
  if (articleError || revisionsError || !article) return <ErrorState message="Revisions could not be loaded." />;

  const hasOpenRevision = revisions?.some((r) => r.status !== "PUBLISHED");

  async function handleCreateRevision() {
    try {
      const revision = await createRevision.mutateAsync(id!);
      toast.success("Revision created as a draft.");
      navigate(`/articles/${revision.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create a revision.");
    }
  }

  return (
    <div>
      <Link to={`/articles/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink">
        <ArrowLeft size={14} /> Back to article
      </Link>

      <PageHeader
        title={`Revisions — ${article.title}`}
        description="Published content can only change by opening a new revision. Publishing the revision replaces the live content."
        actions={
          article.status === "PUBLISHED" && !hasOpenRevision ? (
            <Button onClick={handleCreateRevision} loading={createRevision.isPending}>
              <FilePlus2 size={14} /> Create revision
            </Button>
          ) : undefined
        }
      />

      {!revisions?.length ? (
        <EmptyState
          title="No revisions yet"
          description="Once this article is published, open a revision here to make further edits."
        />
      ) : (
        <ul className="space-y-3">
          {revisions.map((r) => (
            <li key={r.id}>
              <Link
                to={`/articles/${r.id}`}
                className="flex items-center justify-between rounded-lg border border-rule bg-white p-4 shadow-card transition-colors hover:border-masthead/40"
              >
                <div>
                  <p className="text-sm font-medium text-ink">Revision opened {formatDateTime(r.createdAt)}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">Last updated {formatDateTime(r.updatedAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusStamp status={r.status} />
                  <ArrowRight size={15} className="text-ink-faint" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
