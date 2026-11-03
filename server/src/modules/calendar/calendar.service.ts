import { Types } from "mongoose";
import { AppError } from "../../shared/errors/app-error.js";
import { DiaryEntry } from "../diary/diary.model.js";
import { Habit, HabitCompletion } from "../habits/habit.model.js";
import { Project } from "../projects/project.model.js";
import { Task } from "../tasks/task.model.js";
import { CalendarEvent } from "./calendar-event.model.js";

function dateKey(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function plusDay(key: string, n: number) {
  return new Date(Date.parse(`${key}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
function isScheduled(habit: { frequency: string; weekdays: number[] }, key: string) {
  return habit.frequency === "daily" || habit.weekdays.includes(new Date(`${key}T12:00:00Z`).getUTCDay());
}

export async function getCalendarEvents(userId: Types.ObjectId, start: string, end: string) {
  const startAt = new Date(start), endAt = new Date(end);
  if (endAt <= startAt || endAt.getTime() - startAt.getTime() > 93 * 86_400_000) {
    throw new AppError("Calendar range must be valid and no longer than 93 days", 400, "INVALID_CALENDAR_RANGE");
  }
  const [tasks, projects, diary, personal, habits] = await Promise.all([
    Task.find({ userId, deletedAt: null, dueAt: { $gte: startAt, $lt: endAt } }).select("_id title status priority dueAt projectId").lean(),
    Project.find({ userId, archivedAt: null, deadline: { $gte: startAt, $lt: endAt } }).select("_id name status deadline").lean(),
    DiaryEntry.find({ userId, entryDate: { $gte: startAt, $lt: endAt } }).select("_id title entryDate").lean(),
    CalendarEvent.find({ userId, startAt: { $lt: endAt }, $or: [{ endAt: { $gte: startAt } }, { endAt: null, startAt: { $gte: startAt } }] }).lean(),
    Habit.find({ userId, archivedAt: null }).select("_id name frequency weekdays timezone").lean()
  ]);
  const events: Array<Record<string, unknown>> = [
    ...tasks.map(x => ({ id: x._id.toString(), sourceType: "task", title: x.title, start: x.dueAt, allDay: false, metadata: { status: x.status, priority: x.priority, projectId: x.projectId?.toString() ?? null } })),
    ...projects.map(x => ({ id: x._id.toString(), sourceType: "project-deadline", title: x.name, start: x.deadline, allDay: true, metadata: { status: x.status } })),
    ...diary.map(x => ({ id: x._id.toString(), sourceType: "diary", title: x.title || "Diary entry", start: x.entryDate, allDay: true, metadata: {} })),
    ...personal.map(x => ({ id: x._id.toString(), sourceType: "personal", title: x.title, start: x.startAt, end: x.endAt, allDay: x.allDay, metadata: { description: x.description, color: x.color } }))
  ];
  const habitOccurrences: Array<{ habitId: string; name: string; localDate: string; completed: boolean }> = [];
  for (const habit of habits) {
    const first = dateKey(startAt, habit.timezone);
    const last = dateKey(new Date(endAt.getTime() - 1), habit.timezone);
    for (let key = first; key <= last; key = plusDay(key, 1)) {
      if (isScheduled(habit, key)) habitOccurrences.push({ habitId: habit._id.toString(), name: habit.name, localDate: key, completed: false });
    }
  }
  if (habitOccurrences.length) {
    const dates = habitOccurrences.map(item => item.localDate).sort();
    const completed = await HabitCompletion.find({
      userId,
      habitId: { $in: habits.map(habit => habit._id) },
      localDate: { $gte: dates[0], $lte: dates[dates.length - 1] }
    }).select("habitId localDate").lean();
    const completedKeys = new Set(completed.map(item => `${item.habitId.toString()}:${item.localDate}`));
    for (const item of habitOccurrences) {
      item.completed = completedKeys.has(`${item.habitId}:${item.localDate}`);
      events.push({ id: `${item.habitId}:${item.localDate}`, sourceType: "habit", title: item.name, start: item.localDate, allDay: true, metadata: { habitId: item.habitId, completed: item.completed } });
    }
  }
  return events.sort((a, b) => String(a.start).localeCompare(String(b.start)));
}

export async function createPersonalEvent(userId: Types.ObjectId, input: Record<string, any>) {
  return (await CalendarEvent.create({ ...input, userId, startAt: new Date(input.startAt), endAt: input.endAt ? new Date(input.endAt) : null })).toObject();
}
export async function updatePersonalEvent(userId: Types.ObjectId, eventId: string, input: Record<string, any>) {
  const event = await CalendarEvent.findOne({ _id: eventId, userId });
  if (!event) throw new AppError("Calendar event not found", 404, "CALENDAR_EVENT_NOT_FOUND");

  const startAt = input.startAt !== undefined ? new Date(input.startAt) : event.startAt;
  const endAt = input.endAt !== undefined ? (input.endAt ? new Date(input.endAt) : null) : event.endAt;
  if (endAt && endAt < startAt) {
    throw new AppError("End must be after start", 400, "INVALID_EVENT_RANGE");
  }

  Object.assign(event, input, { startAt, endAt });
  await event.save();
  return event.toObject();
}
export async function deletePersonalEvent(userId: Types.ObjectId, eventId: string) {
  const result = await CalendarEvent.deleteOne({ _id: eventId, userId });
  if (!result.deletedCount) throw new AppError("Calendar event not found", 404, "CALENDAR_EVENT_NOT_FOUND");
}
