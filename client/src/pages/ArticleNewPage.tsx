import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import ArticleForm, { ArticleFormValues } from "../components/ArticleForm";
import { useCreateArticle } from "../hooks/useArticles";
import { useToast } from "../lib/ToastContext";
import { ApiError } from "../lib/api";

export default function ArticleNewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const createArticle = useCreateArticle();

  async function handleSubmit(values: ArticleFormValues) {
    try {
      const article = await createArticle.mutateAsync(values);
      toast.success("Article created as a draft.");
      navigate(`/articles/${article.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create the article.");
    }
  }

  return (
    <div>
      <PageHeader title="New article" description="Every new article starts as a draft in the section you choose." />
      <div className="max-w-2xl rounded-lg border border-rule bg-white p-5 shadow-card">
        <ArticleForm onSubmit={handleSubmit} submitting={createArticle.isPending} submitLabel="Create draft" />
      </div>
    </div>
  );
}
