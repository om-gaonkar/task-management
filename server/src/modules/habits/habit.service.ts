import { Types } from "mongoose";
import { AppError } from "../../shared/errors/app-error.js";
import { Habit, HabitCompletion } from "./habit.model.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function localDate(timezone: string, date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function shiftDate(key: string, days: number) {
  return new Date(Date.parse(`${key}T12:00:00.000Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
function weekday(key: string) { return new Date(`${key}T12:00:00.000Z`).getUTCDay(); }
function scheduled(habit: { frequency: string; weekdays: number[] }, key: string) {
  return habit.frequency === "daily" || habit.weekdays.includes(weekday(key));
}
function validateTimezone(timezone: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(); }
  catch { throw new AppError("Invalid IANA timezone", 400, "INVALID_TIMEZONE"); }
}

export async function listHabits(userId: Types.ObjectId) {
  return Habit.find({ userId, archivedAt: null }).sort({ createdAt: -1 }).lean();
}
export async function createHabit(userId: Types.ObjectId, input: Record<string, any>) {
  validateTimezone(input.timezone ?? "Asia/Kolkata");
  return (await Habit.create({ ...input, userId })).toObject();
}
export async function updateHabit(userId: Types.ObjectId, habitId: string, input: Record<string, any>) {
  if (input.timezone) validateTimezone(input.timezone);
  const existing = await Habit.findOne({ _id: habitId, userId, archivedAt: null });
  if (!existing) throw new AppError("Habit not found", 404, "HABIT_NOT_FOUND");
  const nextFrequency = input.frequency ?? existing.frequency;
  const nextWeekdays = input.weekdays ?? existing.weekdays;
  if (nextFrequency === "weekly" && !nextWeekdays.length) throw new AppError("Select at least one weekday", 400, "WEEKDAYS_REQUIRED");
  Object.assign(existing, input);
  await existing.save();
  return existing.toObject();
}
export async function archiveHabit(userId: Types.ObjectId, habitId: string) {
  const habit = await Habit.findOneAndUpdate({ _id: habitId, userId, archivedAt: null }, { $set: { archivedAt: new Date() } }, { new: true });
  if (!habit) throw new AppError("Habit not found", 404, "HABIT_NOT_FOUND");
  return habit.toObject();
}
export async function completeHabit(userId: Types.ObjectId, habitId: string, key: string) {
  const parsed = new Date(`${key}T00:00:00.000Z`);
  if (!DATE_RE.test(key) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== key) {
    throw new AppError("Invalid local date", 400, "INVALID_LOCAL_DATE");
  }
  const habit = await Habit.findOne({ _id: habitId, userId, archivedAt: null });
  if (!habit) throw new AppError("Habit not found", 404, "HABIT_NOT_FOUND");
  if (!scheduled(habit, key)) throw new AppError("This habit is not scheduled for that date", 400, "HABIT_NOT_SCHEDULED");
  try {
    const completion = await HabitCompletion.create({ userId, habitId: habit._id, localDate: key });
    return { completion, alreadyCompleted: false };
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const completion = await HabitCompletion.findOne({ userId, habitId: habit._id, localDate: key }).lean();
    return { completion, alreadyCompleted: true };
  }
}
export async function habitHistory(userId: Types.ObjectId, habitId: string, start?: string, end?: string) {
  if (!(await Habit.exists({ _id: habitId, userId }))) throw new AppError("Habit not found", 404, "HABIT_NOT_FOUND");
  const filter: Record<string, unknown> = { userId, habitId };
  if (start || end) filter.localDate = { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end } : {}) };
  return HabitCompletion.find(filter).sort({ localDate: -1 }).lean();
}
export async function habitStats(userId: Types.ObjectId, habitId: string) {
  const habit = await Habit.findOne({ _id: habitId, userId, archivedAt: null }).lean();
  if (!habit) throw new AppError("Habit not found", 404, "HABIT_NOT_FOUND");
  const today = localDate(habit.timezone);
  const from = shiftDate(today, -29);
  const completions = await HabitCompletion.find({ userId, habitId, localDate: { $gte: shiftDate(today, -365), $lte: today } }).select("localDate").lean();
  const completed = new Set(completions.map(item => item.localDate));
  let expected = 0;
  let done = 0;
  let currentStreak = 0;
  let currentIsOpen = true;
  let run = 0;
  let longestStreak = 0;
  for (let offset = 0; offset < 30; offset++) {
    const key = shiftDate(today, -offset);
    if (scheduled(habit, key)) {
      expected++;
      if (completed.has(key)) done++;
    }
  }
  for (let offset = 0; offset < 365; offset++) {
    const key = shiftDate(today, -offset);
    if (!scheduled(habit, key)) continue;
    if (completed.has(key)) {
      run++;
      longestStreak = Math.max(longestStreak, run);
      if (currentIsOpen) currentStreak++;
    } else {
      run = 0;
      currentIsOpen = false;
    }
  }
  return {
    today, from, through: today,
    completedDaysLast30: done, scheduledDaysLast30: expected,
    adherenceRate: expected ? Math.round(done / expected * 100) : 0,
    currentStreak, longestStreak
  };
}
