import { ArticleStatus } from "../types";

const CONFIG: Record<ArticleStatus, { label: string; color: string; border: string; bg: string }> = {
  DRAFT: { label: "Draft", color: "#6B7280", border: "#D1D5DB", bg: "#F3F4F6" },
  IN_REVIEW: { label: "In review", color: "#92650A", border: "#F0D8A0", bg: "#FDF6E5" },
  APPROVED: { label: "Approved", color: "#0F766E", border: "#A7D9D2", bg: "#EAF7F5" },
  SCHEDULED: { label: "Scheduled", color: "#4338CA", border: "#C4C1F0", bg: "#F0EFFC" },
  PUBLISHED: { label: "Published", color: "#15803D", border: "#B4E0C1", bg: "#EDF9F0" },
};

export default function StatusStamp({ status, overdue = false }: { status: ArticleStatus; overdue?: boolean }) {
  if (overdue) {
    return (
      <span className="stamp" style={{ color: "#B91C1C", borderColor: "#F3C6C6", background: "#FDECEC" }}>
        Overdue
      </span>
    );
  }
  const c = CONFIG[status];
  return (
    <span className="stamp" style={{ color: c.color, borderColor: c.border, background: c.bg }}>
      {c.label}
    </span>
  );
}
