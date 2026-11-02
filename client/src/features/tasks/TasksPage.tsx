import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Circle, ListFilter, Plus, SlidersHorizontal } from "lucide-react";
import { format } from "date-fns";
import { api } from "../../lib/api-client";\nimport { MediaGallery } from "../media/MediaGallery";

type TaskStatus = "todo" | "in-progress" | "completed" | "cancelled";
type Task = { _id: string; title: string; status: TaskStatus; priority: "low" | "medium" | "high" | "urgent"; dueAt: string | null; projectId: string | null; createdAt: string };
type TaskListResponse = { data: { items: Task[]; total: number; page: number; pages: number } };

export function TasksPage() {
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const [title, setTitle] = useState("");\n  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const queryKey = ["tasks", filter] as const;
  const tasksQuery = useQuery({
    queryKey,
    queryFn: () => api<TaskListResponse>(`/tasks?page=1&limit=100${filter === "all" ? "" : `&status=${filter}`}`)
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["tasks"] });
  const createMutation = useMutation({
    mutationFn: (taskTitle: string) => api("/tasks", { method: "POST", body: JSON.stringify({ title: taskTitle, status: "todo", priority: "medium" }) }),
    onSuccess: () => { setTitle(""); void invalidate(); }
  });
  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => api(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: invalidate
  });
  const tasks = tasksQuery.data?.data.items ?? [];

  function addTask() {
    const value = title.trim();
    if (value) createMutation.mutate(value);
  }

  return <div className="feature-page">
    <div className="feature-heading"><div><span className="eyebrow">STAY IN CONTROL</span><h1>My tasks<span className="heading-period">.</span></h1><p className="page-subtitle">Everything you need to do, all in one clear place.</p></div><button className="button button-primary" onClick={() => document.getElementById("new-task")?.focus()}><Plus size={16}/> New task</button></div>
    <div className="feature-toolbar"><div className="view-tabs"><button className="view-tab active"><ListFilter size={15}/> List</button><button className="view-tab" disabled title="Board view is not yet implemented"><Circle size={15}/> Board</button><button className="button button-secondary button-small" disabled title="Advanced filters are not yet implemented"><SlidersHorizontal size={15}/> Filters</button></div><div className="filter-pills">{[["all","All"],["todo","To do"],["in-progress","In progress"],["completed","Completed"]].map(([value,label])=><button key={value} onClick={()=>setFilter(value as typeof filter)} className={filter===value?"selected":""}>{label}</button>)}</div></div>
    <div className="surface-card task-table-card"><div className="table-header"><div><strong>My tasks</strong><span>{tasksQuery.data?.data.total ?? "—"} tasks</span></div><span className="eyebrow">LIVE DATA</span></div>
      {tasksQuery.isLoading ? <div className="empty-state">Loading your tasks…</div> : tasksQuery.isError ? <div className="empty-state"><strong>Couldn't load tasks.</strong><span>{tasksQuery.error.message}</span><button className="button button-secondary button-small" onClick={() => void tasksQuery.refetch()}>Try again</button></div> : tasks.length === 0 ? <div className="empty-state"><strong>No tasks here yet.</strong><span>Add your first task to get started.</span></div> : <div className="task-table">{tasks.map(task => <div className={`task-table-row ${task.status==="completed"?"task-done":""}`} key={task._id}><button className={`task-check ${task.status==="completed"?"checked":""}`} onClick={() => toggleMutation.mutate({ id: task._id, status: task.status==="completed"?"todo":"completed" })} aria-label="Toggle task" disabled={toggleMutation.isPending}>{task.status==="completed"&&<Check size={13}/>}</button><div className="task-table-title"><button className="task-title-button" onClick={() => setExpandedTask(current => current === task._id ? null : task._id)}>{task.title}</button><span>{task.status.replace("-", " ")} · {task.dueAt ? format(new Date(task.dueAt), "MMM d, yyyy") : "No due date"}</span></div><span className={`priority-tag ${task.priority}`}>{task.priority}</span></div>)}</div>}
      <form className="new-task-row" onSubmit={event => { event.preventDefault(); addTask(); }}><input id="new-task" value={title} onChange={event => setTitle(event.target.value)} placeholder="Add a task…"/><button className="icon-button" type="submit" aria-label="Add task" disabled={!title.trim()||createMutation.isPending}><Plus size={18}/></button></form>
    </div>
    {(createMutation.error||toggleMutation.error) && <p className="form-error">{createMutation.error?.message ?? toggleMutation.error?.message}</p>}
  </div>;
}
