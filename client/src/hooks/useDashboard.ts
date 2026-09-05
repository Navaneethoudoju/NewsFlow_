import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  DashboardSummary,
  StatusCount,
  SectionCount,
  WeeklyPublished,
  ArticleEvent,
  UpcomingArticle,
  OverdueAlert,
} from "../types";

export function useDashboardSummary() {
  return useQuery({ queryKey: ["dashboard", "summary"], queryFn: () => api<DashboardSummary>("/dashboard/summary") });
}

export function useDashboardByStatus() {
  return useQuery({ queryKey: ["dashboard", "by-status"], queryFn: () => api<StatusCount[]>("/dashboard/by-status") });
}

export function useDashboardBySection() {
  return useQuery({
    queryKey: ["dashboard", "by-section"],
    queryFn: () => api<SectionCount[]>("/dashboard/by-section"),
  });
}

export function useDashboardWeekly() {
  return useQuery({
    queryKey: ["dashboard", "weekly"],
    queryFn: () => api<WeeklyPublished[]>("/dashboard/weekly-published"),
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ["dashboard", "recent-activity"],
    queryFn: () => api<ArticleEvent[]>("/dashboard/recent-activity"),
  });
}

export function useUpcoming() {
  return useQuery({
    queryKey: ["dashboard", "upcoming"],
    queryFn: () => api<UpcomingArticle[]>("/dashboard/upcoming"),
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: ["alerts"],
    queryFn: () => api<{ count: number; alerts: OverdueAlert[] }>("/alerts"),
    refetchInterval: 60_000,
  });
}

export function useDismissAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (articleId: string) => api<void>(`/alerts/${articleId}/dismiss`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
