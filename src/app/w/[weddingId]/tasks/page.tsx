import { canEdit } from "@/lib/access";
import { todayIn } from "@/lib/datetime";
import { getCtx } from "@/server/action";
import { listPickers, listTasks } from "@/server/planning";
import { TasksView } from "./tasks-view";

export default async function TasksPage({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { ctx, wedding, role } = await getCtx(weddingId);
  const [tasks, pickers] = await Promise.all([listTasks(ctx), listPickers(ctx)]);

  return (
    <TasksView
      weddingId={weddingId}
      tasks={tasks}
      members={pickers.members}
      vendors={pickers.vendors}
      today={todayIn(wedding.timezone)}
      editable={canEdit(role)}
    />
  );
}
