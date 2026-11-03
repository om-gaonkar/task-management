import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Activity, ArrowUpRight, Check, ChevronRight, CircleDollarSign, Clock3, FolderKanban, NotebookPen, Plus, Sparkles, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api-client";

type OverviewTask = { _id: string; title: string; status: string; priority: string; dueAt: string | null };
type OverviewResponse = {
  data: {
    date: string;
    timezone: string;
    tasks: {
      dueToday: OverviewTask[];
      dueTodayCount: number;
      overdueCount: number;
      completedThisWeek: number;
      upcoming: OverviewTask[];
    };
    projects: {
      activeCount: number;
      items: Array<{ id: string; name: string; status: string; deadline: string | null; progress: number; completedTasks: number; totalEligibleTasks: number }>;
    };
    habits: {
      scheduledToday: number;
      completedToday: number;
      items: Array<{ id: string; name: string; completed: boolean }>;
    };
    diary: { recentEntries: Array<{ _id: string; title: string; entryDate: string }> };
    finance: { currency: string; incomeMinor: string; expensesMinor: string; netMinor: string; budgets: unknown[] };
  };
};

function money(minor: string, currency: string) {
  const places = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: places }).format(Number(minor) / 10 ** places);
}

export function OverviewPage({ onQuickCreate }: { onQuickCreate: () => void }) {
  const client = useQueryClient();
  const overview = useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: () => api<OverviewResponse>("/analytics/overview"),
    staleTime: 20_000
  });
  const data = overview.data?.data;
  const completeTask = useMutation({
    mutationFn: (task: OverviewTask) => api(`/tasks/${task._id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: task.status === "completed" ? "todo" : "completed" })
    }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["analytics", "overview"] });
      void client.invalidateQueries({ queryKey: ["tasks"] });
    }
  });
  const completeHabit = useMutation({
    mutationFn: (habitId: string) => api(`/habits/${habitId}/completions`, {
      method: "POST",
      body: JSON.stringify({ localDate: data?.date })
    }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["analytics", "overview"] });
      void client.invalidateQueries({ queryKey: ["habits"] });
      void client.invalidateQueries({ queryKey: ["calendar", "events"] });
    }
  });

  if (overview.isLoading) {
    return <div className="feature-page"><div className="eyebrow">YOUR PERSONAL WORKSPACE</div><h1>Overview<span className="heading-period">.</span></h1><div className="surface-card empty-state">Loading your workspace…</div></div>;
  }
  if (overview.isError || !data) {
    return <div className="feature-page"><div className="eyebrow">YOUR PERSONAL WORKSPACE</div><h1>Overview<span className="heading-period">.</span></h1><div className="surface-card empty-state"><strong>Couldn't load your overview.</strong><span>{overview.error?.message}</span><button className="button button-secondary button-small" onClick={() => void overview.refetch()}>Try again</button></div></div>;
  }

  const date = new Date(`${data.date}T12:00:00`);
  const habitsDone = data.habits.completedToday;
  const habitsTotal = data.habits.scheduledToday;
  const progress = habitsTotal ? Math.round(habitsDone / habitsTotal * 100) : 0;
  const stats = [
    { label: "Tasks due today", value: String(data.tasks.dueTodayCount), foot: `${data.tasks.overdueCount} overdue`, Icon: Clock3, tone: "blue" },
    { label: "Completed this week", value: String(data.tasks.completedThisWeek), foot: "A steady week of progress", Icon: Check, tone: "mint" },
    { label: "Active projects", value: String(data.projects.activeCount), foot: "Projects in your workspace", Icon: FolderKanban, tone: "lilac" },
    { label: "Habits completed", value: `${habitsDone} / ${habitsTotal}`, foot: "Scheduled for today", Icon: Target, tone: "amber" }
  ];

  return <div className="dashboard-page">
    <div className="welcome-row">
      <div><div className="eyebrow">YOUR PERSONAL WORKSPACE</div><h1>Make today <em>count.</em></h1><p className="page-subtitle">{format(date, "EEEE, MMMM d")} · A clear view of what matters today.</p></div>
      <button className="button button-primary" onClick={onQuickCreate}><Plus size={16}/> Quick create</button>
    </div>
    <section className="focus-banner">
      <div className="focus-orb"><Sparkles size={23}/></div>
      <div className="focus-copy"><span>YOUR DAILY RHYTHM</span><h2>{habitsTotal ? (progress === 100 ? "You showed up for every habit." : "Small steps make a strong day.") : "Make space for what matters."}</h2><p>{habitsTotal ? `${habitsDone} of ${habitsTotal} scheduled habits completed today.` : "Add a habit to start building a routine you can measure."}</p></div>
      <div className="focus-progress"><div className="progress-ring">{progress}%</div><div><strong>Today's habits</strong><small>{habitsDone} of {habitsTotal} complete</small></div></div>
    </section>
    <div className="stats-grid">{stats.map(({label,value,foot,Icon,tone})=><article className="stat-card" key={label}><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}><Icon size={17}/></span></div><strong>{value}</strong><div className="stat-foot">{foot}</div></article>)}</div>
    <div className="dashboard-grid">
      <section className="surface-card dashboard-primary-card">
        <div className="section-heading"><div><span className="eyebrow">YOUR SCHEDULE</span><h2>Today's tasks</h2></div><Link to="/tasks" className="text-link">View all <ChevronRight size={15}/></Link></div>
        {data.tasks.dueToday.length ? <div className="task-list">{data.tasks.dueToday.map(task=><div className={`task-row ${task.status === "completed" ? "task-done" : ""}`} key={task._id}>
          <button className={`task-check ${task.status === "completed" ? "checked" : ""}`} aria-label={task.status === "completed" ? "Reopen task" : "Complete task"} onClick={()=>completeTask.mutate(task)} disabled={completeTask.isPending}>{task.status === "completed"&&<Check size={13}/>}</button>
          <div className="task-main"><strong>{task.title}</strong><span>{task.dueAt ? format(new Date(task.dueAt), "h:mm a") : "Due today"}</span></div>
          <div className="task-meta"><span className={`priority-dot ${task.priority}`}>{task.priority}</span><span>{task.status.replace("-", " ")}</span></div>
        </div>)}</div> : <div className="dashboard-empty"><Check size={18}/><strong>Nothing due today.</strong><span>Enjoy the breathing room or add a task for today.</span></div>}
        <Link to="/tasks" className="add-task-inline"><Plus size={16}/> Open task list</Link>
        {completeTask.error&&<p className="form-error">{completeTask.error.message}</p>}
      </section>
      <section className="surface-card">
        <div className="section-heading"><div><span className="eyebrow">IN MOTION</span><h2>Active projects</h2></div><Link to="/projects" className="icon-link" aria-label="View projects"><ArrowUpRight size={17}/></Link></div>
        {data.projects.items.length ? data.projects.items.slice(0,4).map(project=><div className="project-mini" key={project.id}><div className="project-color project-blue">{project.name[0]?.toUpperCase()}</div><div className="project-mini-copy"><strong>{project.name}</strong><span>{project.deadline ? `Due ${format(new Date(project.deadline), "MMM d")}` : "No deadline"}</span><div className="progress-track"><span style={{width:`${project.progress}%`}}/></div></div><b>{project.progress}%</b></div>) : <div className="dashboard-empty compact"><FolderKanban size={18}/><span>No active projects yet.</span><Link to="/projects">Create a project</Link></div>}
      </section>
      <section className="surface-card">
        <div className="section-heading"><div><span className="eyebrow">SMALL, DAILY WINS</span><h2>Daily habits</h2></div><Link to="/habits" className="icon-link" aria-label="View habits"><ArrowUpRight size={17}/></Link></div>
        {data.habits.items.length ? <div className="habit-list">{data.habits.items.map(habit=><div className="habit-row" key={habit.id}><span className="habit-emoji"><Target size={15}/></span><div><strong>{habit.name}</strong><small>{habit.completed ? "Completed today" : "Scheduled for today"}</small></div><button className={`habit-count ${habit.completed ? "habit-count-done" : ""}`} onClick={()=>completeHabit.mutate(habit.id)} disabled={habit.completed||completeHabit.isPending} aria-label={habit.completed ? `${habit.name} completed` : `Complete ${habit.name}`}>{habit.completed ? <Check size={14}/> : <Plus size={14}/>}</button></div>)}</div> : <div className="dashboard-empty compact"><Target size={18}/><span>No habits scheduled today.</span><Link to="/habits">Manage habits</Link></div>}
        {completeHabit.error&&<p className="form-error">{completeHabit.error.message}</p>}
      </section>
      <section className="surface-card">
        <div className="section-heading"><div><span className="eyebrow">MONTH AT A GLANCE</span><h2>Money snapshot</h2></div><Link to="/finance" className="icon-link" aria-label="Open finance"><CircleDollarSign size={17}/></Link></div>
        <div className="finance-snapshot"><div><span>Income</span><strong>{money(data.finance.incomeMinor,data.finance.currency)}</strong></div><div><span>Expenses</span><strong>{money(data.finance.expensesMinor,data.finance.currency)}</strong></div><div className="finance-net"><span>Net cash flow</span><strong>{money(data.finance.netMinor,data.finance.currency)}</strong></div></div>
        <Link to="/finance" className="diary-cta button button-soft">View finances <ArrowUpRight size={15}/></Link>
      </section>
      <section className="surface-card dashboard-diary-card">
        <div className="section-heading"><div><span className="eyebrow">A MOMENT FOR YOU</span><h2>Recent reflections</h2></div><NotebookPen size={18} className="muted-icon"/></div>
        {data.diary.recentEntries.length ? data.diary.recentEntries.map(entry=><Link className="recent-reflection" key={entry._id} to={`/diary?date=${encodeURIComponent(entry.entryDate.slice(0,10))}&item=${encodeURIComponent(entry._id)}`}><span>{format(new Date(entry.entryDate), "MMM d")}</span><strong>{entry.title || "Untitled entry"}</strong><ArrowUpRight size={14}/></Link>) : <div className="dashboard-empty compact"><NotebookPen size={18}/><span>Your reflections will appear here.</span><Link to="/diary">Write an entry</Link></div>}
      </section>
      <section className="surface-card dashboard-upcoming-card">
        <div className="section-heading"><div><span className="eyebrow">COMING UP</span><h2>Next few days</h2></div><Link to="/calendar" className="icon-link" aria-label="Open calendar"><Activity size={17}/></Link></div>
        {data.tasks.upcoming.length ? data.tasks.upcoming.slice(0,4).map(task=><div className="upcoming-row" key={task._id}><span className={`priority-dot ${task.priority}`}/><div><strong>{task.title}</strong><small>{task.dueAt ? format(new Date(task.dueAt), "EEE, MMM d") : "Upcoming"}</small></div></div>) : <div className="dashboard-empty compact"><Clock3 size={18}/><span>No upcoming tasks in the next week.</span></div>}
      </section>
    </div>
  </div>;
}
