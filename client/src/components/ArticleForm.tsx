import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Button from "./Button";
import { useSections } from "../hooks/useSections";
import { useAuth } from "../lib/AuthContext";
import { Article } from "../types";

const schema = z.object({
  title: z.string().min(1, "Title is required.").max(300, "Title is too long."),
  body: z.string().min(1, "Content is required."),
  sectionId: z.string().min(1, "Choose a section."),
});

export type ArticleFormValues = z.infer<typeof schema>;

export default function ArticleForm({
  initial,
  onSubmit,
  submitting,
  submitLabel = "Save",
}: {
  initial?: Partial<Article>;
  onSubmit: (values: ArticleFormValues) => Promise<void> | void;
  submitting: boolean;
  submitLabel?: string;
}) {
  const { user } = useAuth();
  const isEditor = user?.role === "EDITOR";
  const { data: sections } = useSections(false);
  const [dirty, setDirty] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
  } = useForm<ArticleFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initial?.title ?? "",
      body: initial?.body ?? "",
      sectionId: initial?.sectionId ?? "",
    },
  });

  useEffect(() => setDirty(isDirty), [isDirty]);

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const availableSections = isEditor ? sections : sections?.filter((s) => !s.archived);
  const bodyValue = watch("body");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-ink-light" htmlFor="title">
          Title
        </label>
        <input
          id="title"
          {...register("title")}
          className="mt-1 w-full rounded-md border border-rule bg-white px-3 py-2 text-sm focus:border-masthead focus:outline-none"
          placeholder="A clear, specific headline"
        />
        {errors.title && <p className="mt-1 text-xs text-status-overdue">{errors.title.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-light" htmlFor="sectionId">
          Section
        </label>
        <select
          id="sectionId"
          {...register("sectionId")}
          className="mt-1 w-full rounded-md border border-rule bg-white px-3 py-2 text-sm focus:border-masthead focus:outline-none"
        >
          <option value="">Choose a section…</option>
          {availableSections?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.archived ? " (archived)" : ""}
            </option>
          ))}
        </select>
        {errors.sectionId && <p className="mt-1 text-xs text-status-overdue">{errors.sectionId.message}</p>}
        {!availableSections?.length && (
          <p className="mt-1 text-xs text-ink-faint">
            {isEditor ? "Create a section first." : "You are not assigned to any section yet — ask an editor to assign you."}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-ink-light" htmlFor="body">
            Content
          </label>
          <span className="text-xs text-ink-faint">{bodyValue?.length ?? 0} characters</span>
        </div>
        <textarea
          id="body"
          {...register("body")}
          rows={16}
          className="mt-1 w-full rounded-md border border-rule bg-white px-3 py-2 text-sm leading-relaxed focus:border-masthead focus:outline-none"
          placeholder="Write the article body…"
        />
        {errors.body && <p className="mt-1 text-xs text-status-overdue">{errors.body.message}</p>}
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
        {dirty && <span className="text-xs text-ink-faint">Unsaved changes</span>}
      </div>
    </form>
  );
}
