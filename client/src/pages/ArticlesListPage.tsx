import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search, Download, CalendarClock, Ban, ArrowUpDown, Check, X } from "lucide-react";
import PageHeader from "../components/PageHeader";
import Button from "../components/Button";
import StatusStamp from "../components/StatusStamp";
import Pagination from "../components/Pagination";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { Modal } from "../components/Modal";
import { useAuth } from "../lib/AuthContext";
import { useSections } from "../hooks/useSections";
import { useArticles, useBulkSchedule, useBulkUnpublish, downloadCalendarCsv } from "../hooks/useArticles";
import { useToast } from "../lib/ToastContext";
import { ArticleStatus, BulkResult } from "../types";
import { formatDateTime } from "../lib/format";
import { ApiError } from "../lib/api";

const STATUS_OPTIONS: { value: ArticleStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "IN_REVIEW", label: "In review" },
  { value: "APPROVED", label: "Approved" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "PUBLISHED", label: "Published" },
];

export default function ArticlesListPage() {
  const { user } = useAuth();
  const isEditor = user?.role === "EDITOR";
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { data: sections } = useSections(false);

  const search = params.get("search") ?? "";
  const sectionId = params.get("sectionId") ?? "";
  const status = (params.get("status") as ArticleStatus) ?? "";
  const sortBy = (params.get("sortBy") as any) ?? "updatedAt";
  const sortOrder = (params.get("sortOrder") as any) ?? "desc";
  const page = Number(params.get("page") ?? "1");

  const [searchInput, setSearchInput] = useState(search);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ label: string; items: (BulkResult & { title: string })[] } | null>(
    null
  );

  const query = useMemo(
    () => ({
      search: search || undefined,
      sectionId: sectionId || undefined,
      status: status || undefined,
      sortBy,
      sortOrder,
      page,
      pageSize: 15,
    }),
    [search, sectionId, status, sortBy, sortOrder, page]
  );

  const { data, isLoading, isError } = useArticles(query);
  const bulkSchedule = useBulkSchedule();
  const bulkUnpublish = useBulkUnpublish();

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  }

  function toggleSort(field: string) {
    if (sortBy === field) {
      updateParam("sortOrder", sortOrder === "asc" ? "desc" : "asc");
      updateParam("sortBy", field);
    } else {
      const next = new URLSearchParams(params);
      next.set("sortBy", field);
      next.set("sortOrder", "desc");
      next.delete("page");
      setParams(next);
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!data) return;
    setSelected((prev) => (prev.size === data.items.length ? new Set() : new Set(data.items.map((a) => a.id))));
  }

  // Attach each result back to its article's title (from the currently
  // loaded page) so the results panel can name articles, not just IDs.
  function withTitles(results: BulkResult[]): (BulkResult & { title: string })[] {
    const titleById = new Map((data?.items ?? []).map((a) => [a.id, a.title]));
    return results.map((r) => ({ ...r, title: titleById.get(r.articleId) ?? r.articleId }));
  }

  async function handleBulkSchedule() {
    if (!scheduleAt) return;
    const response = await bulkSchedule.mutateAsync({
      articleIds: Array.from(selected),
      publishAt: new Date(scheduleAt).toISOString(),
    });
    setScheduleOpen(false);
    setScheduleAt("");
    setSelected(new Set());
    setBulkResults({ label: `Bulk schedule — ${formatDateTime(new Date(scheduleAt).toISOString())}`, items: withTitles(response.results) });
  }

  async function handleBulkUnpublish() {
    const response = await bulkUnpublish.mutateAsync({ articleIds: Array.from(selected) });
    setUnpublishOpen(false);
    setSelected(new Set());
    setBulkResults({ label: "Bulk unpublish", items: withTitles(response.results) });
  }

  async function handleExport() {
    try {
      await downloadCalendarCsv();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not export the calendar.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Articles"
        description="Search, filter, and manage every article across the newsroom."
        actions={
          <>
            {isEditor && (
              <Button variant="secondary" onClick={handleExport}>
                <Download size={15} /> Export calendar
              </Button>
            )}
            <Link to="/articles/new">
              <Button>
                <Plus size={15} /> New article
              </Button>
            </Link>
          </>
        }
      />

      <div className="rounded-lg border border-rule bg-white shadow-card">
        <div className="flex flex-col gap-3 border-b border-rule p-3 sm:flex-row sm:items-center">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateParam("search", searchInput);
            }}
            className="relative flex-1"
          >
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search title or content…"
              className="w-full rounded-md border border-rule bg-paper py-1.5 pl-8 pr-3 text-sm focus:border-masthead focus:outline-none"
            />
          </form>
          <select
            value={sectionId}
            onChange={(e) => updateParam("sectionId", e.target.value)}
            className="rounded-md border border-rule bg-paper px-2.5 py-1.5 text-sm text-ink-light"
          >
            <option value="">All sections</option>
            {sections?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => updateParam("status", e.target.value)}
            className="rounded-md border border-rule bg-paper px-2.5 py-1.5 text-sm text-ink-light"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {isEditor && selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-rule bg-paper-dim px-3 py-2">
            <span className="text-sm text-ink-light">{selected.size} selected</span>
            <Button size="sm" variant="secondary" onClick={() => setScheduleOpen(true)}>
              <CalendarClock size={14} /> Bulk schedule
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setUnpublishOpen(true)}>
              <Ban size={14} /> Bulk unpublish
            </Button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-ink-faint hover:text-ink">
              Clear
            </button>
          </div>
        )}

        {isLoading ? (
          <LoadingState label="Loading articles…" />
        ) : isError ? (
          <ErrorState message="Could not load articles. Please try again." />
        ) : !data?.items.length ? (
          <EmptyState
            title="No articles match these filters"
            description="Try clearing a filter, or create a new article to get started."
            action={
              <Link to="/articles/new">
                <Button size="sm">
                  <Plus size={14} /> New article
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-rule text-xs uppercase tracking-wide text-ink-faint">
                  {isEditor && (
                    <th className="w-8 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.size === data.items.length}
                        onChange={toggleSelectAll}
                        aria-label="Select all articles"
                      />
                    </th>
                  )}
                  <th className="px-3 py-2">
                    <button className="flex items-center gap-1 hover:text-ink" onClick={() => toggleSort("createdAt")}>
                      Title <ArrowUpDown size={11} />
                    </button>
                  </th>
                  <th className="px-3 py-2">Section</th>
                  <th className="px-3 py-2">Author</th>
                  <th className="px-3 py-2">
                    <button className="flex items-center gap-1 hover:text-ink" onClick={() => toggleSort("status")}>
                      Status <ArrowUpDown size={11} />
                    </button>
                  </th>
                  <th className="px-3 py-2">
                    <button className="flex items-center gap-1 hover:text-ink" onClick={() => toggleSort("publishAt")}>
                      Publish time <ArrowUpDown size={11} />
                    </button>
                  </th>
                  <th className="px-3 py-2">
                    <button className="flex items-center gap-1 hover:text-ink" onClick={() => toggleSort("updatedAt")}>
                      Updated <ArrowUpDown size={11} />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((article) => (
                  <tr key={article.id} className="border-b border-rule last:border-0 hover:bg-paper-dim/40">
                    {isEditor && (
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selected.has(article.id)}
                          onChange={() => toggleSelected(article.id)}
                          aria-label={`Select ${article.title}`}
                        />
                      </td>
                    )}
                    <td className="max-w-xs px-3 py-2.5">
                      <Link to={`/articles/${article.id}`} className="font-medium text-ink hover:text-masthead">
                        {article.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-ink-light">{article.section.name}</td>
                    <td className="px-3 py-2.5 text-ink-light">{article.author.name}</td>
                    <td className="px-3 py-2.5">
                      <StatusStamp
                        status={article.status}
                        overdue={article.status === "SCHEDULED" && !!article.publishAt && new Date(article.publishAt) < new Date()}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-ink-light">{formatDateTime(article.publishAt ?? article.publishedAt)}</td>
                    <td className="px-3 py-2.5 text-ink-faint">{formatDateTime(article.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!!data?.items.length && (
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            onPageChange={(p) => updateParam("page", String(p))}
          />
        )}
      </div>

      <Modal open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="Bulk schedule">
        <p className="text-sm text-ink-light">
          Schedule {selected.size} article(s) for publication. Each article is validated individually — some may fail
          if they aren't in Approved status.
        </p>
        <label className="mt-4 block text-sm font-medium text-ink-light">Publish date &amp; time</label>
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
          <Button onClick={handleBulkSchedule} loading={bulkSchedule.isPending} disabled={!scheduleAt}>
            Schedule
          </Button>
        </div>
      </Modal>

      <Modal open={unpublishOpen} onClose={() => setUnpublishOpen(false)} title="Bulk unpublish">
        <p className="text-sm text-ink-light">
          Unpublish {selected.size} article(s)? Each will move back to Approved status. This does not delete content.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setUnpublishOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleBulkUnpublish} loading={bulkUnpublish.isPending}>
            Unpublish
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!bulkResults}
        onClose={() => setBulkResults(null)}
        title={bulkResults?.label ?? "Bulk action results"}
        width="max-w-lg"
      >
        {bulkResults && (
          <>
            <p className="mb-3 text-sm text-ink-faint">
              {bulkResults.items.filter((r) => r.success).length} of {bulkResults.items.length} succeeded.
            </p>
            <ul className="max-h-80 divide-y divide-rule overflow-y-auto rounded-md border border-rule">
              {bulkResults.items.map((r) => (
                <li key={r.articleId} className="flex items-start gap-2.5 px-3 py-2.5">
                  {r.success ? (
                    <Check size={16} className="mt-0.5 shrink-0 text-status-approved" />
                  ) : (
                    <X size={16} className="mt-0.5 shrink-0 text-status-overdue" />
                  )}
                  <div>
                    <p className="text-sm text-ink">{r.title}</p>
                    {!r.success && r.reason && <p className="text-xs text-status-overdue">{r.reason}</p>}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={() => setBulkResults(null)}>
                Close
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
