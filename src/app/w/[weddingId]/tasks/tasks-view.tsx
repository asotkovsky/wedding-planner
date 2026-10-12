"use client";

import { ClipboardCheck, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { OpenAssistantButton } from "@/components/assistant/open-assistant-button";
import { celebrateFrom } from "@/components/celebrate";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { Field, NONE, noneToEmpty, SelectField, TextareaField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { formObject, useAction } from "@/components/use-action";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Task } from "@/server/planning";
import * as actions from "./actions";

type Option = { id: string; name: string };
type Props = { weddingId: string; tasks: Task[]; members: Option[]; vendors: Option[]; today: string; editable: boolean };

export function TasksView(props: Props) {
  const { tasks, today, editable } = props;
  const [showDone, setShowDone] = useState(false);
  const [dialog, setDialog] = useState<Task | "new" | null>(null);

  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");
  const in30 = addDays(today, 30);
  const groups: [string, Task[]][] = [
    ["Overdue", open.filter((t) => t.dueDate && t.dueDate < today)],
    ["Next 30 days", open.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= in30)],
    ["Later", open.filter((t) => t.dueDate && t.dueDate > in30)],
    ["No due date", open.filter((t) => !t.dueDate)],
  ];

  return (
    <div className="space-y-6">
      <PageHeader section="tasks" description={tasks.length ? `${open.length} to go · ${done.length} done${done.length ? " 🎉" : ""}` : undefined}>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={showDone} onCheckedChange={setShowDone} /> Show done
        </label>
        {editable && (
          <Button onClick={() => setDialog("new")}>
            <Plus /> Add task
          </Button>
        )}
      </PageHeader>

      {groups.map(
        ([label, list]) =>
          list.length > 0 && (
            <section key={label} className="space-y-1">
              <h2 className={cn("text-sm font-bold", label === "Overdue" && "text-late")}>{label}</h2>
              <ul className="divide-y rounded-2xl border bg-card">
                {list.map((t) => (
                  <TaskRow key={t.id} {...props} task={t} onEdit={() => setDialog(t)} />
                ))}
              </ul>
            </section>
          ),
      )}
      {showDone && done.length > 0 && (
        <section className="space-y-1">
          <h2 className="text-sm font-medium">Done</h2>
          <ul className="divide-y rounded-2xl border bg-card">
            {done.map((t) => (
              <TaskRow key={t.id} {...props} task={t} onEdit={() => setDialog(t)} />
            ))}
          </ul>
        </section>
      )}
      {tasks.length === 0 && (
        <EmptyState
          icon={ClipboardCheck}
          tone="sun"
          title="A beautifully blank to-do list"
          description="Add your first task, or let your planner draft a full checklist from now until the big day."
        >
          <OpenAssistantButton prompt="Generate a planning checklist from now until the wedding.">Draft my checklist</OpenAssistantButton>
        </EmptyState>
      )}
      {editable && dialog && <TaskDialog {...props} task={dialog === "new" ? undefined : dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

function TaskRow({ weddingId, task, members, today, editable, onEdit }: Props & { task: Task; onEdit: () => void }) {
  const { pending, run } = useAction();
  const assignee = members.find((m) => m.id === task.assigneeUserId);
  const isDone = task.status === "done";

  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <Checkbox
        checked={isDone}
        disabled={!editable || pending}
        aria-label="Done"
        className="size-5 rounded-md"
        onCheckedChange={async (c) => {
          const el = document.activeElement;
          const ok = await run(() => actions.updateTask(weddingId, task.id, { status: c ? "done" : "todo" }));
          if (ok && c) celebrateFrom(el);
        }}
      />
      <div className="min-w-0 flex-1">
        <div className={cn("font-medium", isDone && "text-muted-foreground line-through")}>{task.title}</div>
        <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
          {task.dueDate && (
            <span className={cn(!isDone && task.dueDate < today && "font-semibold text-late")}>
              Due {formatDate(task.dueDate, { dateStyle: "medium" })}
            </span>
          )}
          {assignee && <span>· {assignee.name}</span>}
          {task.description && <span className="truncate">· {task.description}</span>}
        </div>
      </div>
      {task.status === "in_progress" && <StatusPill status="maybe">In progress</StatusPill>}
      {task.category && <Badge variant="outline">{task.category}</Badge>}
      {editable && (
        <div className="flex">
          <Button variant="ghost" size="icon-sm" aria-label="Edit task" onClick={onEdit}>
            <Pencil />
          </Button>
          <ConfirmButton
            title="Delete this task?"
            description={task.title}
            onConfirm={() => run(() => actions.deleteTask(weddingId, task.id), "Task deleted")}
          >
            <Button variant="ghost" size="icon-sm" aria-label="Delete task">
              <Trash2 />
            </Button>
          </ConfirmButton>
        </div>
      )}
    </li>
  );
}

function TaskDialog({ weddingId, members, vendors, task, onClose }: Props & { task?: Task; onClose: () => void }) {
  const { pending, run } = useAction();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = formObject(e.currentTarget);
    const input = {
      title: f.title,
      description: f.description,
      category: f.category,
      dueDate: f.dueDate,
      status: f.status as "todo",
      assigneeUserId: noneToEmpty(f.assigneeUserId),
      vendorId: noneToEmpty(f.vendorId),
    };
    const ok = task
      ? await run(() => actions.updateTask(weddingId, task.id, input), "Task saved")
      : await run(() => actions.createTask(weddingId, input), "Task added");
    if (ok) onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "Add task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <Field name="title" label="Title" required defaultValue={task?.title} className="sm:col-span-2" />
          <Field name="dueDate" label="Due date" type="date" defaultValue={task?.dueDate ?? ""} />
          <SelectField
            name="status"
            label="Status"
            defaultValue={task?.status ?? "todo"}
            options={[
              { value: "todo", label: "To do" },
              { value: "in_progress", label: "In progress" },
              { value: "done", label: "Done" },
            ]}
          />
          <SelectField
            name="assigneeUserId"
            label="Assignee"
            defaultValue={task?.assigneeUserId ?? NONE}
            options={[{ value: NONE, label: "Unassigned" }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
          />
          <Field name="category" label="Category" defaultValue={task?.category ?? ""} placeholder="e.g. Venue" />
          {vendors.length > 0 && (
            <SelectField
              name="vendorId"
              label="Related vendor"
              defaultValue={task?.vendorId ?? NONE}
              options={[{ value: NONE, label: "None" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]}
              className="sm:col-span-2"
            />
          )}
          <TextareaField name="description" label="Notes" defaultValue={task?.description ?? ""} className="sm:col-span-2" />
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
