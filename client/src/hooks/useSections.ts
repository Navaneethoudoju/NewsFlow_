import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Section, UserRef } from "../types";

export function useSections(includeArchived = true) {
  return useQuery({
    queryKey: ["sections", { includeArchived }],
    queryFn: () => api<Section[]>("/sections", { query: { includeArchived } }),
  });
}

export function useSection(id: string | undefined) {
  return useQuery({
    queryKey: ["sections", id],
    queryFn: () => api<Section>(`/sections/${id}`),
    enabled: !!id,
  });
}

export function useWriters() {
  return useQuery({
    queryKey: ["writers"],
    queryFn: () => api<UserRef[]>("/sections/writers"),
  });
}

export function useEditors() {
  return useQuery({
    queryKey: ["editors"],
    queryFn: () => api<UserRef[]>("/sections/editors"),
  });
}

export function useCreateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description: string; ownerEditorId?: string }) =>
      api<Section>("/sections", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sections"] }),
  });
}

export function useUpdateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { name?: string; description?: string; ownerEditorId?: string };
    }) => api<Section>(`/sections/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sections"] }),
  });
}

export function useSetSectionArchived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api<Section>(`/sections/${id}/${archived ? "archive" : "restore"}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sections"] }),
  });
}

export function useAssignWriter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sectionId, writerId }: { sectionId: string; writerId: string }) =>
      api<Section>(`/sections/${sectionId}/writers`, { method: "POST", body: JSON.stringify({ writerId }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sections"] }),
  });
}

export function useRemoveWriter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sectionId, writerId }: { sectionId: string; writerId: string }) =>
      api<Section>(`/sections/${sectionId}/writers/${writerId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sections"] }),
  });
}
