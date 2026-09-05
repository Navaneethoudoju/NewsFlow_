import { ArticleStatus, Role } from "@prisma/client";
import { AppError } from "./errors";

// The only place transition rules are defined. Routes/services must call
// through here rather than setting `status` directly, or the rules in this
// file stop meaning anything.
// APPROVED/SCHEDULED -> IN_REVIEW is not reachable through an explicit
// TransitionAction below — it happens as a side effect of editing content
// (see article.service.ts#updateArticleContent) — but it's listed here so
// this table is a complete picture of the state machine, not just of the
// /transition endpoint.
export const TRANSITIONS: Record<ArticleStatus, ArticleStatus[]> = {
  DRAFT: ["IN_REVIEW"],
  IN_REVIEW: ["DRAFT", "APPROVED"],
  APPROVED: ["SCHEDULED", "PUBLISHED", "IN_REVIEW"],
  SCHEDULED: ["PUBLISHED", "APPROVED", "IN_REVIEW"],
  PUBLISHED: ["APPROVED"],
};

export type TransitionAction =
  | "SUBMIT_FOR_REVIEW"
  | "SEND_BACK_TO_DRAFT"
  | "APPROVE"
  | "SCHEDULE"
  | "PUBLISH"
  | "UNSCHEDULE"
  | "UNPUBLISH";

interface ActionDef {
  from: ArticleStatus;
  to: ArticleStatus;
  allowedRoles: Role[];
  label: string;
}

export const ACTIONS: Record<TransitionAction, ActionDef> = {
  SUBMIT_FOR_REVIEW: {
    from: "DRAFT",
    to: "IN_REVIEW",
    allowedRoles: ["WRITER", "EDITOR"],
    label: "Submit for review",
  },
  SEND_BACK_TO_DRAFT: {
    from: "IN_REVIEW",
    to: "DRAFT",
    allowedRoles: ["EDITOR"],
    label: "Send back to draft",
  },
  APPROVE: {
    from: "IN_REVIEW",
    to: "APPROVED",
    allowedRoles: ["EDITOR"],
    label: "Approve",
  },
  SCHEDULE: {
    from: "APPROVED",
    to: "SCHEDULED",
    allowedRoles: ["EDITOR"],
    label: "Schedule",
  },
  PUBLISH: {
    // Publish is allowed directly from APPROVED or from SCHEDULED (early
    // publish of an already-scheduled article). Resolved dynamically below.
    from: "APPROVED",
    to: "PUBLISHED",
    allowedRoles: ["EDITOR"],
    label: "Publish",
  },
  UNSCHEDULE: {
    from: "SCHEDULED",
    to: "APPROVED",
    allowedRoles: ["EDITOR"],
    label: "Unschedule",
  },
  UNPUBLISH: {
    from: "PUBLISHED",
    to: "APPROVED",
    allowedRoles: ["EDITOR"],
    label: "Unpublish",
  },
};

export function canTransition(from: ArticleStatus, to: ArticleStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export interface TransitionContext {
  action: TransitionAction;
  currentStatus: ArticleStatus;
  actorId: string;
  actorRole: Role;
  authorId: string;
  publishAt?: Date | null;
}

/**
 * Validates a requested transition against the state machine, role rules,
 * and business conditions (e.g. an approver cannot be the article's author).
 * Throws AppError with a useful message on any violation; otherwise returns
 * the resolved target status.
 */
export function validateTransition(ctx: TransitionContext): ArticleStatus {
  const { action, currentStatus, actorId, actorRole, authorId, publishAt } = ctx;

  // PUBLISH is valid from either APPROVED or SCHEDULED.
  const from = currentStatus;
  const to: ArticleStatus = action === "PUBLISH" ? "PUBLISHED" : ACTIONS[action].to;

  if (!canTransition(from, to)) {
    throw AppError.invalidTransition(
      `Cannot go from ${from} to ${to}.`,
      { from, to, action }
    );
  }

  // Role gate for the specific action being requested.
  const def = ACTIONS[action];
  if (from !== def.from && !(action === "PUBLISH" && from === "SCHEDULED")) {
    throw AppError.invalidTransition(
      `"${def.label}" is not valid from status ${from}.`
    );
  }
  if (!def.allowedRoles.includes(actorRole)) {
    throw AppError.forbidden(`Only ${def.allowedRoles.join(" or ")} can ${def.label.toLowerCase()}.`);
  }

  // Business rule: a writer may submit their own draft, but every downstream
  // approval-type action must be performed by someone other than the author.
  if (["APPROVE", "SCHEDULE", "PUBLISH"].includes(action) && actorId === authorId) {
    throw AppError.forbidden(
      "An editor other than the article's author must approve this article."
    );
  }

  if ((action === "SCHEDULE") ) {
    if (!publishAt) {
      throw AppError.validation("A future publish date/time is required to schedule an article.");
    }
    if (publishAt.getTime() <= Date.now()) {
      throw AppError.validation("Scheduled publish time must be in the future.");
    }
  }

  return to;
}

export const HUMAN_ACTION_LABEL: Record<TransitionAction, string> = Object.fromEntries(
  Object.entries(ACTIONS).map(([k, v]) => [k, v.label])
) as Record<TransitionAction, string>;
