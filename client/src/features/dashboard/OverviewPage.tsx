import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Check, ChevronRight, Clock3, FolderKanban, NotebookPen, Plus, Sparkles, Target, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

const metrics: Array<{ label: string; value: string; Icon: LucideIcon; tone: string }> = [
  { label: "Tasks completed", value: "08 / 12", Icon: Check, tone: "mint" },
  { label: "Active projects", value: "04", Icon: FolderKanban, tone: "lilac" },
  { label: "Habits on track", value: "3 / 4", Icon: Target, tone: "amber" },
  { label: "Focus time", value: "4.5 hrs", Icon: Clock3, tone: "blue" }
];
const sampleTasks = [
  { title: "Review Q4 product roadmap", project: "Product launch", time: "10:30 AM", priority: "High", done: false },
  { title: "Finalize landing page copy", project: "Website refresh", time: "12:00 PM", priority: "Medium", done: false },
  { title: "Send invoice to design partner", project: "Operations", time: "2:30 PM", priority: "Low", done: true }
];
const sampleProjects = [
  { name: "Website refresh", percent: 60, tone: "coral" },
  { name: "Product launch", percent: 38, tone: "blue" },
  { name: "Learn TypeScript", percent: 67, tone: "green" }
];
const sampleHabits = [["☀️", "Morning pages"], ["💧", "Drink 2L water"], ["📚", "Read 20 pages"]];

export function OverviewPage({ onQuickCreate }: { onQuickCreate: () => void }) {
  return <div className="dashboard-page">
    <div className="welcome-row"><div><div className="eyebrow">YOUR PERSONAL WORKSPACE</div><h1>Make today <em>count.</em></h1><p className="page-subtitle">A little progress, consistently, adds up to something big.</p></div><button className="button button-secondary" onClick={onQuickCreate}><Plus size={16}/> Quick create</button></div>
    <section className="focus-banner"><div className="focus-orb"><Sparkles size={23}/></div><div className="focus-copy"><span>YOUR DAILY FOCUS</span><h2>Do fewer things, better.</h2><p>Choose what matters most and give it your full attention.</p></div><div className="focus-progress"><div className="progress-ring">2/5</div><div><strong>Daily rhythm</strong><small>Preview content</small></div></div></section>
    <div className="stats-grid">{metrics.map(({ label, value, Icon, tone }) => <article className="stat-card" key={label}><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}><Icon size={17}/></span></div><strong>{value}</strong><div className="stat-foot">Preview metric <span className="trend"><TrendingUp size={13}/> —</span></div></article>)}</div>
    <div className="dashboard-grid">
      <section className="surface-card"><div className="section-heading"><div><span className="eyebrow">YOUR SCHEDULE</span><h2>Today's tasks</h2></div><Link to="/tasks" className="text-link">View all <ChevronRight size={15}/></Link></div><div className="task-list">{sampleTasks.map(task => <div className={`task-row ${task.done ? "task-done" : ""}`} key={task.title}><span className={`task-check ${task.done ? "checked" : ""}`}>{task.done && <Check size={13}/>}</span><div className="task-main"><strong>{task.title}</strong><span>{task.project}</span></div><div className="task-meta"><span className={`priority-dot ${task.priority.toLowerCase()}`}>{task.priority}</span><span>{task.time}</span></div></div>)}</div><Link to="/tasks" className="add-task-inline"><Plus size={16}/> Open task list</Link></section>
      <section className="surface-card"><div className="section-heading"><div><span className="eyebrow">IN MOTION</span><h2>Active projects</h2></div><Link to="/projects" className="icon-link"><ArrowUpRight size={17}/></Link></div>{sampleProjects.map(project => <div className="project-mini" key={project.name}><div className={`project-color project-${project.tone}`}>{project.name[0]}</div><div className="project-mini-copy"><strong>{project.name}</strong><span>Preview progress</span><div className="progress-track"><span style={{ width: `${project.percent}%` }}/></div></div><b>{project.percent}%</b></div>)}</section>
      <section className="surface-card"><div className="section-heading"><div><span className="eyebrow">SMALL, DAILY WINS</span><h2>Daily habits</h2></div><Link to="/habits" className="icon-link"><ArrowUpRight size={17}/></Link></div><div className="habit-list">{sampleHabits.map(([emoji, name]) => <div className="habit-row" key={name}><span className="habit-emoji">{emoji}</span><div><strong>{name}</strong><small>Preview habit</small></div><span className="habit-count">Demo</span></div>)}</div></section>
      <section className="surface-card"><div className="section-heading"><div><span className="eyebrow">A MOMENT FOR YOU</span><h2>Daily reflection</h2></div><NotebookPen size={18} className="muted-icon"/></div><div className="diary-prompt"><span className="quote-mark">“</span><p>What is one thing that made you feel proud today?</p></div><Link to="/diary" className="button button-soft diary-cta">Write a journal entry <ArrowUpRight size={15}/></Link></section>
    </div><div className="dashboard-footnote"><Sparkles size={14}/> Preview data only — connect persistent APIs before relying on these metrics.</div>
  </div>;
}
