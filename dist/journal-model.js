import { GRADES } from './model.js';

const DAY = 24 * 60 * 60 * 1000;

function dateValue(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new RangeError('日期须使用 YYYY-MM-DD 格式。');
  }
  const value = Date.parse(`${date}T12:00:00Z`);
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== date) {
    throw new RangeError('请输入有效日期。');
  }
  return value;
}

export function shiftDate(date, days) {
  if (!Number.isInteger(days)) throw new RangeError('日期偏移须为整数天。');
  return new Date(dateValue(date) + days * DAY).toISOString().slice(0, 10);
}

export function weekStart(date) {
  const weekday = new Date(dateValue(date)).getUTCDay();
  return shiftDate(date, -(weekday + 6) % 7);
}

export function weekDates(date) {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, index) => shiftDate(start, index));
}

export function islandSummary(day, date, today) {
  const tasks = day?.tasks ?? [];
  const total = tasks.length;
  const done = tasks.filter(task => task.done).length;
  const ratio = total ? done / total : 0;
  const hasS = tasks.some(task => task.grade === 'S');
  const sDone = tasks.some(task => task.grade === 'S' && task.done);
  const recorded = Boolean(total || day?.started);
  const status = date > today ? 'future' : recorded && day?.ended ? 'completed' : 'incomplete';
  let stars = 0;
  if (status === 'completed' && done > 0) {
    stars = ratio === 1 ? 3 : ratio >= 0.6 ? 2 : 1;
    if (!sDone) stars = Math.min(stars, 1);
  }
  return { date, status, stars, total, done, ratio, hasS, sDone, recorded };
}

export function dashboard(db, today) {
  const stats = {
    completedDays: 0,
    recordedDays: 0,
    completedTasks: 0,
    totalTasks: 0,
    completionRate: 0,
    stars: 0,
    perfectDays: 0,
    grades: GRADES.map(grade => ({ grade, total: 0, done: 0, ratio: 0 })),
    starCounts: [0, 0, 0, 0]
  };
  const grades = new Map(stats.grades.map(grade => [grade.grade, grade]));
  for (const [date, day] of Object.entries(db.days ?? {})) {
    if (date > today) continue;
    const summary = islandSummary(day, date, today);
    // Rollover creates and settles empty days; these are not visits or records.
    if (!summary.recorded) continue;
    stats.recordedDays += 1;
    stats.completedTasks += summary.done;
    stats.totalTasks += summary.total;
    if (summary.status === 'completed') {
      stats.completedDays += 1;
      stats.stars += summary.stars;
      stats.starCounts[summary.stars] += 1;
      if (summary.stars === 3) stats.perfectDays += 1;
    }
    for (const task of day.tasks ?? []) {
      const grade = grades.get(task.grade);
      if (!grade) continue;
      grade.total += 1;
      if (task.done) grade.done += 1;
    }
  }
  stats.completionRate = stats.totalTasks ? stats.completedTasks / stats.totalTasks : 0;
  for (const grade of stats.grades) grade.ratio = grade.total ? grade.done / grade.total : 0;
  return stats;
}

