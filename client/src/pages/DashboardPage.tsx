import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FileEdit, Eye, CheckCircle2, CalendarClock, Rss, AlertTriangle } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import {
  useDashboardBySection,
  useDashboardByStatus,
  useDashboardSummary,
  useDashboardWeekly,
  useRecentActivity,
  useUpcoming,
} from "../hooks/useDashboard";
import { LoadingState } from "../components/States";
import PageHeader from "../components/PageHeader";
import { formatDateTime, formatRelative } from "../lib/format";
import { EventType } from "../types";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  APPROVED: "Approved",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
};

const EVENT_LABEL: Record<EventType, string> = {
  STATUS_CHANGE: "changed status on",
  REVISION_OPENED: "opened a revision of",
  REVISION_PUBLISHED: "published a revision of",
  COMMENT: "commented on",
  ALERT_DISMISSED: "dismissed an overdue alert for",
};

function MetricCard({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "default" | "warn";
}) {
  return (
    <div className="rounded-lg border border-rule bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span
          className={`rounded-md p-1.5 ${
            tone === "warn" ? "bg-status-overdue/10 text-status-overdue" : "bg-paper-dim text-ink-light"
          }`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 font-serif text-3xl font-semibold text-ink">{value}</p>
      <p className="text-xs uppercase tracking-wide text-ink-faint font-mono">{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: summary, isLoading: loadingSummary } = useDashboardSummary();
  const { data: byStatus } = useDashboardByStatus();
  const { data: bySection } = useDashboardBySection();
  const { data: weekly } = useDashboardWeekly();
  const { data: recent } = useRecentActivity();
  const { data: upcoming } = useUpcoming();

  const statusChartData = (byStatus ?? []).map((s) => ({ name: STATUS_LABEL[s.status] ?? s.status, count: s.count }));
  const sectionChartData = (bySection ?? []).map((s) => ({ name: s.sectionName, count: s.count }));
  const weeklyChartData = (weekly ?? []).map((w) => ({
    name: new Date(w.weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    count: w.count,
  }));

  return (
    <div>
      <PageHeader
        title="Newsroom dashboard"
        description={`Welcome back, ${user?.name?.split(" ")[0] ?? ""}. Here's where things stand.`}
      />

      {loadingSummary || !summary ? (
        <LoadingState label="Loading dashboard…" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard label="Drafts" value={summary.drafts} icon={<FileEdit size={16} />} />
            <MetricCard label="In review" value={summary.inReview} icon={<Eye size={16} />} />
            <MetricCard label="Approved" value={summary.approved} icon={<CheckCircle2 size={16} />} />
            <MetricCard label="Scheduled" value={summary.scheduled} icon={<CalendarClock size={16} />} />
            <MetricCard label="Published" value={summary.published} icon={<Rss size={16} />} />
            <MetricCard label="Overdue" value={summary.overdue} icon={<AlertTriangle size={16} />} tone="warn" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-rule bg-white p-4 shadow-card">
              <h3 className="font-serif text-base font-semibold text-ink">Articles by status</h3>
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusChartData} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EAE6DA" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#7C8798" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#7C8798" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: "#F6F4EE" }}
                      contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #D9D3C5" }}
                    />
                    <Bar dataKey="count" fill="#8F2A1E" radius={[3, 3, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-rule bg-white p-4 shadow-card">
              <h3 className="font-serif text-base font-semibold text-ink">Articles by section</h3>
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectionChartData} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EAE6DA" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#7C8798" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#7C8798" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: "#F6F4EE" }}
                      contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #D9D3C5" }}
                    />
                    <Bar dataKey="count" fill="#4338CA" radius={[3, 3, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-rule bg-white p-4 shadow-card lg:col-span-2">
              <h3 className="font-serif text-base font-semibold text-ink">Published per week — last 8 weeks</h3>
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyChartData} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EAE6DA" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#7C8798" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#7C8798" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #D9D3C5" }} />
                    <Line type="monotone" dataKey="count" stroke="#15803D" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-rule bg-white shadow-card">
              <div className="border-b border-rule px-4 py-3">
                <h3 className="font-serif text-base font-semibold text-ink">Recent activity</h3>
              </div>
              <ul className="divide-y divide-rule">
                {(recent ?? []).slice(0, 8).map((event) => (
                  <li key={event.id} className="px-4 py-2.5 text-sm">
                    <Link to={`/articles/${event.articleId}/history`} className="text-ink hover:text-masthead">
                      <span className="font-medium">{event.actor.name}</span>{" "}
                      <span className="text-ink-faint">{EVENT_LABEL[event.type]}</span>{" "}
                      <span className="font-medium">{event.article.title}</span>
                    </Link>
                    <p className="text-xs text-ink-faint">{formatRelative(event.createdAt)}</p>
                  </li>
                ))}
                {!recent?.length && <li className="px-4 py-6 text-center text-sm text-ink-faint">No activity yet.</li>}
              </ul>
            </div>

            <div className="rounded-lg border border-rule bg-white shadow-card">
              <div className="border-b border-rule px-4 py-3">
                <h3 className="font-serif text-base font-semibold text-ink">Upcoming publications</h3>
              </div>
              <ul className="divide-y divide-rule">
                {(upcoming ?? []).map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <Link to={`/articles/${a.id}`} className="truncate font-medium text-ink hover:text-masthead">
                        {a.title}
                      </Link>
                      <p className="text-xs text-ink-faint">
                        {a.section.name} · {a.author.name}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-faint">{formatDateTime(a.publishAt)}</span>
                  </li>
                ))}
                {!upcoming?.length && (
                  <li className="px-4 py-6 text-center text-sm text-ink-faint">Nothing scheduled.</li>
                )}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
