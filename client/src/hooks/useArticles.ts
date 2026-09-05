import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiCsv } from "../lib/api";
import {
  Article,
  ArticleListResponse,
  ArticleStatus,
  Comment,
  ArticleEvent,
  BulkResult,
  TransitionAction,
} from "../types";

export interface ArticleListQuery {
  search?: string;
  sectionId?: string;
  status?: ArticleStatus;
  authorId?: string;
  sortBy?: "updatedAt" | "createdAt" | "status" | "publishAt";
  sortOrder?: "asc" | "desc";
  page: number;
  pageSize: number;
}

export function useArticles(query: ArticleListQuery) {
  return useQuery({
    queryKey: ["articles", query],
    queryFn: () => api<ArticleListResponse>("/articles", { query: query as any }),
    placeholderData: (prev) => prev,
  });
}

export function useArticle(id: string | undefined) {
  return useQuery({
    queryKey: ["articles", id],
    queryFn: () => api<Article>(`/articles/${id}`),
    enabled: !!id,
  });
}

export function useCreateArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; body: string; sectionId: string; authorId?: string }) =>
      api<Article>("/articles", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["articles"] }),
  });
}

export function useUpdateArticle(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title?: string; body?: string; sectionId?: string }) =>
      api<Article>(`/articles/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["articles", id] });
    },
  });
}

export function useTransitionArticle(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { action: TransitionAction; publishAt?: string }) =>
      api<Article>(`/articles/${id}/transition`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["articles", id] });
      qc.invalidateQueries({ queryKey: ["articles", id, "history"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

export function useCreateRevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (originalId: string) => api<Article>(`/articles/${originalId}/revisions`, { method: "POST" }),
    onSuccess: (_data, originalId) => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["articles", originalId, "revisions"] });
    },
  });
}

export function useRevisions(originalId: string | undefined) {
  return useQuery({
    queryKey: ["articles", originalId, "revisions"],
    queryFn: () => api<Article[]>(`/articles/${originalId}/revisions`),
    enabled: !!originalId,
  });
}

export function useArticleHistory(id: string | undefined) {
  return useQuery({
    queryKey: ["articles", id, "history"],
    queryFn: () => api<ArticleEvent[]>(`/articles/${id}/history`),
    enabled: !!id,
  });
}

export function useComments(articleId: string | undefined) {
  return useQuery({
    queryKey: ["articles", articleId, "comments"],
    queryFn: () => api<Comment[]>(`/articles/${articleId}/comments`),
    enabled: !!articleId,
  });
}

export function useAddComment(articleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      api<Comment>(`/articles/${articleId}/comments`, { method: "POST", body: JSON.stringify({ content }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles", articleId, "comments"] });
      qc.invalidateQueries({ queryKey: ["articles", articleId, "history"] });
    },
  });
}

export function useBulkSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { articleIds: string[]; publishAt: string }) =>
      api<{ results: BulkResult[] }>("/articles/bulk/schedule", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

export function useBulkUnpublish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { articleIds: string[] }) =>
      api<{ results: BulkResult[] }>("/articles/bulk/unpublish", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

export async function downloadCalendarCsv() {
  const blob = await apiCsv("/articles/export/calendar.csv");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "editorial-calendar.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
