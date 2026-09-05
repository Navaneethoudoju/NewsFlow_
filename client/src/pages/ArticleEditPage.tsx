import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import ArticleForm, { ArticleFormValues } from "../components/ArticleForm";
import { useArticle, useUpdateArticle } from "../hooks/useArticles";
import { LoadingState, ErrorState } from "../components/States";
import { useToast } from "../lib/ToastContext";
import { ApiError } from "../lib/api";

export default function ArticleEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: article, isLoading, isError } = useArticle(id);
  const updateArticle = useUpdateArticle(id!);

  async function handleSubmit(values: ArticleFormValues) {
    try {
      await updateArticle.mutateAsync(values);
      toast.success("Article updated.");
      navigate(`/articles/${id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save changes.");
    }
  }

  if (isLoading) return <LoadingState label="Loading article…" />;
  if (isError || !article) return <ErrorState message="This article could not be loaded." />;

  return (
    <div>
      <PageHeader title="Edit article" description={article.title} />
      <div className="max-w-2xl rounded-lg border border-rule bg-white p-5 shadow-card">
        <ArticleForm initial={article} onSubmit={handleSubmit} submitting={updateArticle.isPending} submitLabel="Save changes" />
      </div>
    </div>
  );
}
