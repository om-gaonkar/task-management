import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Columns3, Filter, List, Plus, SlidersHorizontal } from "lucide-react";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";
import { api } from "../../lib/api-client";
import { MediaGallery } from "../media/MediaGallery";

type TaskStatus = "todo" | "in-progress" | "completed" | "cancelled";
type Priority = "low" | "medium" | "high" | "urgent";
type Task = { _id: string; title: string; status: TaskStatus; priority: Priority; dueAt: string | null; projectId: string | null; createdAt: string };
type TaskListResponse = { data: { items: Task[]; total: number; page: number; pages: number } };
const statuses: Array<{ value: TaskStatus; label: string }> = [
  { value: "todo", label: "To do" },
  { value: "in-progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" }
];

export function TasksPage() {
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<"list" | "board">("list");
  const [title, setTitle] = useState("");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
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
  const visibleTasks = useMemo(() => tasks.filter(task => priorityFilter === "all" || task.priority === priorityFilter), [tasks, priorityFilter]);

  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    document.getElementById("new-task")?.focus();
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const item = searchParams.get("item");
    if (item && tasks.some(task => task._id === item)) setExpandedTask(item);
  }, [searchParams, tasks]);

  function addTask() {
    const value = title.trim();
    if (value) createMutation.mutate(value);
  }
  function changeStatus(task: Task, status: TaskStatus) {
    if (task.status !== status) toggleMutation.mutate({ id: task._id, status });
  }

  return <div className="feature-page">
    <div className="feature-heading"><div><span className="eyebrow">STAY IN CONTROL</span><h1>My tasks<span className="heading-period">.</span></h1><p className="page-subtitle">Everything you need to do, all in one clear place.</p></div><button className="button button-primary" onClick={() => document.getElementById("new-task")?.focus()}><Plus size={16}/> New task</button></div>
    <div className="feature-toolbar">
      <div className="view-tabs">
        <button className={`view-tab ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}><List size={15}/> List</button>
        <button className={`view-tab ${view === "board" ? "active" : ""}`} onClick={() => setView("board")}><Columns3 size={15}/> Board</button>
        <button className={`button button-secondary button-small ${showFilters ? "filter-active" : ""}`} onClick={() => setShowFilters(value => !value)}><SlidersHorizontal size={15}/> Filters</button>
      </div>
      <div className="filter-pills">{[["all", "All"], ...statuses.map(status => [status.value, status.label])].map(([value, label]) => <button key={value} onClick={() => setFilter(value as typeof filter)} className={filter === value ? "selected" : ""}>{label}</button>)}</div>
    </div>
    {showFilters && <div className="task-filter-panel"><label htmlFor="task-priority-filter"><Filter size={14}/> Priority</label><select id="task-priority-filter" value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as typeof priorityFilter)}><option value="all">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><button className="text-link" onClick={() => { setPriorityFilter("all"); setFilter("all"); }}>Clear filters</button></div>}
    <div className="surface-card task-table-card">
      <div className="table-header"><div><strong>{view === "list" ? "My tasks" : "Task board"}</strong><span>{visibleTasks.length} shown · {tasksQuery.data?.data.total ?? "—"} total</span></div><span className="eyebrow">LIVE DATA</span></div>
      {tasksQuery.isLoading ? <div className="empty-state">Loading your tasks…</div> : tasksQuery.isError ? <div className="empty-state"><strong>Couldn't load tasks.</strong><span>{tasksQuery.error.message}</span><button className="button button-secondary button-small" onClick={() => void tasksQuery.refetch()}>Try again</button></div> :
        view === "list" ? visibleTasks.length === 0 ? <div className="empty-state"><strong>No tasks match this view.</strong><span>Change the filters or add a task to get started.</span></div> : <div className="task-table">{visibleTasks.map(task => <div className="task-row-wrap" key={task._id}>
          <div className={`task-table-row ${task.status === "completed" ? "task-done" : ""}`}>
            <button className={`task-check ${task.status === "completed" ? "checked" : ""}`} onClick={() => changeStatus(task, task.status === "completed" ? "todo" : "completed")} aria-label={task.status === "completed" ? "Reopen task" : "Complete task"} disabled={toggleMutation.isPending}>{task.status === "completed" && <Check size={13}/>}</button>
            <div className="task-table-title"><button className="task-title-button" onClick={() => setExpandedTask(current => current === task._id ? null : task._id)}>{task.title}</button><span>{task.status.replace("-", " ")} · {task.dueAt ? format(new Date(task.dueAt), "MMM d, yyyy") : "No due date"}</span></div>
            <span className={`priority-tag ${task.priority}`}>{task.priority}</span>
            <select aria-label={`Change status for ${task.title}`} className="task-status-select" value={task.status} onChange={event => changeStatus(task, event.target.value as TaskStatus)} disabled={toggleMutation.isPending}>{statuses.map(status => <option value={status.value} key={status.value}>{status.label}</option>)}</select>
          </div>
          {expandedTask === task._id && <div className="task-attachments"><MediaGallery parentType="task" parentId={task._id}/></div>}
        </div>)}</div> : <div className="task-board">{statuses.map(status => {
          const columnTasks = visibleTasks.filter(task => task.status === status.value);
          return <section className="task-board-column" key={status.value}><div className="task-board-heading"><strong>{status.label}</strong><span>{columnTasks.length}</span></div>{columnTasks.length ? columnTasks.map(task => <article className="task-board-card" key={task._id}><div><span className={`priority-tag ${task.priority}`}>{task.priority}</span><button className="task-title-button" onClick={() => setExpandedTask(current => current === task._id ? null : task._id)}>{task.title}</button><small>{task.dueAt ? `Due ${format(new Date(task.dueAt), "MMM d")}` : "No due date"}</small></div><select aria-label={`Move ${task.title}`} value={task.status} onChange={event => changeStatus(task, event.target.value as TaskStatus)} disabled={toggleMutation.isPending}>{statuses.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{expandedTask === task._id && <MediaGallery parentType="task" parentId={task._id}/>}</article>) : <div className="task-board-empty">No tasks</div>}</section>;
        })}</div>}
      <form className="new-task-row" onSubmit={event => { event.preventDefault(); addTask(); }}><input id="new-task" value={title} onChange={event => setTitle(event.target.value)} placeholder="Add a task…"/><button className="icon-button" type="submit" aria-label="Add task" disabled={!title.trim() || createMutation.isPending}><Plus size={18}/></button></form>
    </div>
    {(createMutation.error || toggleMutation.error) && <p className="form-error">{createMutation.error?.message ?? toggleMutation.error?.message}</p>}
  </div>;
}
