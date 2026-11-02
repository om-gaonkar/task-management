import { Types } from "mongoose";
import { User } from "../users/user.model.js";
import { Task } from "../tasks/task.model.js";
import { Project } from "../projects/project.model.js";
import { Habit, HabitCompletion } from "../habits/habit.model.js";
import { DiaryEntry } from "../diary/diary.model.js";
import { Transaction } from "../finance/transaction.model.js";
import { financeSummary, listBudgets } from "../finance/finance.service.js";

function dateKey(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function shiftDate(key: string, days: number) {
  return new Date(Date.parse(`${key}T12:00:00.000Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
function startOfLocalDay(key: string, timezone: string) {
  const [year, month, day] = key.split("-").map(Number);
  const target = Date.UTC(year!, month! - 1, day!);
  let guess = target;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  });
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part => [part.type, part.value]));
    const observed = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    guess += target - observed;
  }
  return new Date(guess);
}
function scheduled(habit: { frequency: string; weekdays: number[] }, key: string) {
  return habit.frequency === "daily" || habit.weekdays.includes(new Date(`${key}T12:00:00.000Z`).getUTCDay());
}

export async function getOverview(userId: Types.ObjectId) {
  const user = await User.findById(userId).select("preferences.timezone preferences.currency").lean();
  const timezone = user?.preferences?.timezone ?? "Asia/Kolkata";
  const currency = user?.preferences?.currency ?? "INR";
  const now = new Date();
  const today = dateKey(now, timezone);
  const todayStart = startOfLocalDay(today, timezone);
  const tomorrowStart = startOfLocalDay(shiftDate(today, 1), timezone);
  const weekday = new Date(`${today}T12:00:00.000Z`).getUTCDay();
  const weekStart = startOfLocalDay(shiftDate(today, -((weekday + 6) % 7)), timezone);
  const month = today.slice(0, 7);
  const monthStart = startOfLocalDay(`${month}-01`, timezone);
  const nextMonth = month.endsWith("-12") ? `${Number(month.slice(0, 4)) + 1}-01-01` : `${month.slice(0, 5)}${String(Number(month.slice(5, 7)) + 1).padStart(2, "0")}-01`;
  const monthEnd = startOfLocalDay(nextMonth, timezone);

  const [
    todayTasks, overdueTasks, completedThisWeek, activeProjects, upcomingTasks,
    upcomingProjects, habits, todayCompletions, recentDiary, monthlyFinance, budgets
  ] = await Promise.all([
    Task.find({ userId, deletedAt: null, dueAt: { $gte: todayStart, $lt: tomorrowStart } }).sort({ priority: -1, dueAt: 1 }).limit(10).select("title status priority dueAt projectId").lean(),
    Task.countDocuments({ userId, deletedAt: null, dueAt: { $lt: todayStart }, status: { $nin: ["completed", "cancelled"] } }),
    Task.countDocuments({ userId, deletedAt: null, status: "completed", completedAt: { $gte: weekStart, $lt: tomorrowStart } }),
    Project.find({ userId, archivedAt: null, status: { $in: ["planning", "active", "on-hold"] } }).sort({ deadline: 1 }).limit(8).select("name status deadline").lean(),
    Task.find({ userId, deletedAt: null, dueAt: { $gte: tomorrowStart, $lt: startOfLocalDay(shiftDate(today, 8), timezone) }, status: { $nin: ["completed", "cancelled"] } }).sort({ dueAt: 1 }).limit(8).select("title status priority dueAt projectId").lean(),
    Project.find({ userId, archivedAt: null, deadline: { $gte: todayStart, $lt: startOfLocalDay(shiftDate(today, 31), timezone) } }).sort({ deadline: 1 }).limit(5).select("name status deadline").lean(),
    Habit.find({ userId, archivedAt: null }).sort({ createdAt: 1 }).lean(),
    HabitCompletion.find({ userId, localDate: today }).select("habitId").lean(),
    DiaryEntry.find({ userId }).sort({ entryDate: -1, createdAt: -1 }).limit(4).select("title entryDate").lean(),
    financeSummary(userId, monthStart.toISOString(), monthEnd.toISOString()),
    listBudgets(userId, month)
  ]);

  const projectIds = activeProjects.map(project => project._id);
  const projectTasks = projectIds.length
    ? await Task.find({ userId, projectId: { $in: projectIds }, deletedAt: null }).select("_id projectId parentId status dueAt").lean()
    : [];
  const parentIds = new Set(projectTasks.map(task => task.parentId?.toString()).filter(Boolean));
  const projectsWithProgress = activeProjects.map(project => {
    const leaves = projectTasks.filter(task => task.projectId?.toString() === project._id.toString() && !parentIds.has(task._id.toString()));
    const completed = leaves.filter(task => task.status === "completed").length;
    return {
      id: project._id.toString(), name: project.name, status: project.status,
      deadline: project.deadline, completedTasks: completed, totalEligibleTasks: leaves.length,
      progress: leaves.length ? Math.round(completed / leaves.length * 100) : 0
    };
  });
  const completedHabitIds = new Set(todayCompletions.map(item => item.habitId.toString()));
  const todayHabits = habits.filter(habit => scheduled(habit, today)).map(habit => ({
    id: habit._id.toString(), name: habit.name, completed: completedHabitIds.has(habit._id.toString())
  }));
  const expenses = await Transaction.find({ userId, type: "expense", occurredAt: { $gte: monthStart, $lt: monthEnd }, currency }).select("amountMinor").lean();
  const income = await Transaction.find({ userId, type: "income", occurredAt: { $gte: monthStart, $lt: monthEnd }, currency }).select("amountMinor").lean();
  const sum = (items: Array<{ amountMinor: number }>) => items.reduce((total, item) => total + BigInt(item.amountMinor), 0n).toString();

  return {
    date: today, timezone, tasks: {
      dueToday: todayTasks, dueTodayCount: todayTasks.length, overdueCount: overdueTasks,
      completedThisWeek, upcoming: upcomingTasks
    },
    projects: { activeCount: activeProjects.length, items: projectsWithProgress, upcomingDeadlines: upcomingProjects },
    habits: { scheduledToday: todayHabits.length, completedToday: todayHabits.filter(item => item.completed).length, items: todayHabits },
    diary: { recentEntries: recentDiary },
    finance: {
      currency, month, incomeMinor: sum(income), expensesMinor: sum(expenses),
      netMinor: (BigInt(sum(income)) - BigInt(sum(expenses))).toString(), budgets
    }
  };
}

export async function getProductivityAnalytics(userId: Types.ObjectId, from: string, to: string, timezone: string) {
  const start = new Date(from), end = new Date(to);
  if (end <= start || end.getTime() - start.getTime() > 366 * 86_400_000) {
    throw new Error("Analytics date range must be valid and no longer than 366 days");
  }
  const [statusDistribution, priorityDistribution, completedTasks, projects, completions] = await Promise.all([
    Task.aggregate([{ $match: { userId, deletedAt: null, createdAt: { $lt: end } } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Task.aggregate([{ $match: { userId, deletedAt: null, createdAt: { $lt: end } } }, { $group: { _id: "$priority", count: { $sum: 1 } } }]),
    Task.find({ userId, deletedAt: null, status: "completed", completedAt: { $gte: start, $lt: end } }).select("completedAt").lean(),
    Project.find({ userId, archivedAt: null }).select("_id name status").lean(),
    HabitCompletion.find({ userId, completedAt: { $gte: start, $lt: end } }).select("completedAt habitId").lean()
  ]);
  const completedByDay = new Map<string, number>();
  for (const task of completedTasks) {
    const key = dateKey(task.completedAt!, timezone);
    completedByDay.set(key, (completedByDay.get(key) ?? 0) + 1);
  }
  const habitsByDay = new Map<string, number>();
  for (const item of completions) {
    const key = dateKey(item.completedAt, timezone);
    habitsByDay.set(key, (habitsByDay.get(key) ?? 0) + 1);
  }
  return {
    completedTasksByDay: [...completedByDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })),
    habitCompletionsByDay: [...habitsByDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })),
    statusDistribution: statusDistribution.map(item => ({ status: item._id, count: item.count })),
    priorityDistribution: priorityDistribution.map(item => ({ priority: item._id, count: item.count })),
    activeProjects: projects.map(project => ({ id: project._id.toString(), name: project.name, status: project.status }))
  };
}

export async function getFinanceAnalytics(userId: Types.ObjectId, from: string, to: string, currency?: string) {
  return financeSummary(userId, from, to, currency);
}
