import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Archive, ArchiveRestore, Users, X } from "lucide-react";
import PageHeader from "../components/PageHeader";
import Button from "../components/Button";
import { Modal, ConfirmDialog } from "../components/Modal";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { useAuth } from "../lib/AuthContext";
import {
  useSections,
  useWriters,
  useEditors,
  useCreateSection,
  useUpdateSection,
  useSetSectionArchived,
  useAssignWriter,
  useRemoveWriter,
} from "../hooks/useSections";
import { useToast } from "../lib/ToastContext";
import { ApiError } from "../lib/api";
import { Section } from "../types";

function SectionFormModal({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Section;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const { data: editors } = useEditors();
  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [ownerEditorId, setOwnerEditorId] = useState(initial?.ownerEditorId ?? user?.id ?? "");

  const submitting = createSection.isPending || updateSection.isPending;

  async function handleSubmit() {
    try {
      if (initial) {
        await updateSection.mutateAsync({ id: initial.id, input: { name, description, ownerEditorId } });
        toast.success("Section updated.");
      } else {
        await createSection.mutateAsync({ name, description, ownerEditorId });
        toast.success("Section created.");
      }
      onClose();
      setName("");
      setDescription("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save the section.");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit section" : "New section"}>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-ink-light">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-rule px-3 py-2 text-sm focus:border-masthead focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-light">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-rule px-3 py-2 text-sm focus:border-masthead focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-light">Owning editor</label>
          <select
            value={ownerEditorId}
            onChange={(e) => setOwnerEditorId(e.target.value)}
            className="mt-1 w-full rounded-md border border-rule bg-white px-3 py-2 text-sm focus:border-masthead focus:outline-none"
          >
            {(editors ?? []).map((ed) => (
              <option key={ed.id} value={ed.id}>
                {ed.name}
                {ed.id === user?.id ? " (you)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          loading={submitting}
          disabled={!name.trim() || !description.trim() || !ownerEditorId}
        >
          {initial ? "Save changes" : "Create section"}
        </Button>
      </div>
    </Modal>
  );
}

function ManageWritersModal({ open, onClose, section }: { open: boolean; onClose: () => void; section?: Section }) {
  const toast = useToast();
  const { data: allWriters } = useWriters();
  const assign = useAssignWriter();
  const remove = useRemoveWriter();

  if (!section) return null;

  const assignedIds = new Set(section.writers.map((w) => w.writer.id));

  async function toggle(writerId: string, assigned: boolean) {
    try {
      if (assigned) {
        await remove.mutateAsync({ sectionId: section!.id, writerId });
      } else {
        await assign.mutateAsync({ sectionId: section!.id, writerId });
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update writer assignment.");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Writers — ${section.name}`}>
      <ul className="max-h-80 divide-y divide-rule overflow-y-auto">
        {(allWriters ?? []).map((w) => {
          const assigned = assignedIds.has(w.id);
          return (
            <li key={w.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-ink">{w.name}</p>
                <p className="text-xs text-ink-faint">{w.email}</p>
              </div>
              <Button
                size="sm"
                variant={assigned ? "danger" : "secondary"}
                onClick={() => toggle(w.id, assigned)}
                loading={assign.isPending || remove.isPending}
              >
                {assigned ? <X size={13} /> : <Plus size={13} />}
                {assigned ? "Remove" : "Add"}
              </Button>
            </li>
          );
        })}
        {!allWriters?.length && <li className="py-6 text-center text-sm text-ink-faint">No writers found.</li>}
      </ul>
    </Modal>
  );
}

export default function SectionsPage() {
  const { user } = useAuth();
  const isEditor = user?.role === "EDITOR";
  const toast = useToast();

  const { data: sections, isLoading, isError } = useSections(true);
  const setArchived = useSetSectionArchived();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Section | undefined>(undefined);
  const [writersFor, setWritersFor] = useState<Section | undefined>(undefined);
  const [archiveTarget, setArchiveTarget] = useState<Section | undefined>(undefined);

  if (isLoading) return <LoadingState label="Loading sections…" />;
  if (isError) return <ErrorState message="Sections could not be loaded." />;

  async function confirmArchiveToggle() {
    if (!archiveTarget) return;
    try {
      await setArchived.mutateAsync({ id: archiveTarget.id, archived: !archiveTarget.archived });
      toast.success(archiveTarget.archived ? "Section restored." : "Section archived.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update the section.");
    } finally {
      setArchiveTarget(undefined);
    }
  }

  return (
    <div>
      <PageHeader
        title="Sections"
        description={isEditor ? "Create, edit, and archive editorial sections." : "Sections you are assigned to."}
        actions={
          isEditor ? (
            <Button
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <Plus size={14} /> New section
            </Button>
          ) : undefined
        }
      />

      {!sections?.length ? (
        <EmptyState
          title="No sections yet"
          description={isEditor ? "Create your first section to get started." : "You have not been assigned to any sections."}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map((s) => (
            <div
              key={s.id}
              className={`rounded-lg border bg-white p-4 shadow-card ${s.archived ? "border-rule opacity-60" : "border-rule"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-serif text-lg font-semibold text-ink">{s.name}</p>
                  <p className="mt-0.5 text-sm text-ink-light">{s.description}</p>
                </div>
                {s.archived && (
                  <span className="shrink-0 rounded-[3px] border border-rule bg-paper-dim px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                    Archived
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
                <span>Owner: {s.ownerEditor.name}</span>
                <span>{s._count.articles} article{s._count.articles === 1 ? "" : "s"}</span>
                <Link to={`/articles?sectionId=${s.id}`} className="text-masthead hover:underline">
                  View articles
                </Link>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {s.writers.map(({ writer }) => (
                  <span key={writer.id} className="rounded-full bg-paper-dim px-2.5 py-1 text-xs text-ink-light">
                    {writer.name}
                  </span>
                ))}
                {!s.writers.length && <span className="text-xs text-ink-faint">No writers assigned.</span>}
              </div>

              {isEditor && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-rule pt-3">
                  <Button size="sm" variant="secondary" onClick={() => setWritersFor(s)}>
                    <Users size={13} /> Writers
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditing(s);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil size={13} /> Edit
                  </Button>
                  <Button size="sm" variant={s.archived ? "secondary" : "danger"} onClick={() => setArchiveTarget(s)}>
                    {s.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                    {s.archived ? "Restore" : "Archive"}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <SectionFormModal key={editing?.id ?? "new"} open={formOpen} onClose={() => setFormOpen(false)} initial={editing} />
      <ManageWritersModal open={!!writersFor} onClose={() => setWritersFor(undefined)} section={writersFor} />
      <ConfirmDialog
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(undefined)}
        onConfirm={confirmArchiveToggle}
        title={archiveTarget?.archived ? "Restore section" : "Archive section"}
        description={
          archiveTarget?.archived
            ? "This section will become available again for new articles."
            : "Archived sections stop accepting new articles but keep their existing data and remain visible in history."
        }
        confirmLabel={archiveTarget?.archived ? "Restore" : "Archive"}
        danger={!archiveTarget?.archived}
        loading={setArchived.isPending}
      />
    </div>
  );
}
