import test from 'node:test';
import assert from 'node:assert/strict';
import { weekStart, shiftDate, weekDates, islandSummary, dashboard } from '../dist/journal-model.js';

const today = '2026-10-20';
const day = (tasks = [], extra = {}) => ({ tasks, started: true, ended: true, ...extra });
const tasks = (total, done, sDone = true) => Array.from({ length: total }, (_, index) => ({
  grade: index === 0 ? 'S' : ['A', 'B', 'C', 'F'][(index - 1) % 4],
  done: index === 0 ? sDone && done > 0 : index <= done - (sDone ? 1 : 0)
}));

test('weeks always contain Monday through Sunday, including year and leap-day boundaries', () => {
  assert.equal(weekStart('2026-10-20'), '2026-10-19');
  assert.equal(weekStart('2026-10-25'), '2026-10-19');
  assert.equal(weekStart('2026-10-19'), '2026-10-19');
  assert.deepEqual(weekDates('2027-01-01'), [
    '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31',
    '2027-01-01', '2027-01-02', '2027-01-03'
  ]);
  assert.equal(shiftDate('2028-02-28', 1), '2028-02-29');
  assert.equal(shiftDate('2028-02-29', 1), '2028-03-01');
  assert.equal(shiftDate('2026-03-08', 1), '2026-03-09');
  assert.equal(shiftDate('2026-11-01', -1), '2026-10-31');
  assert.throws(() => weekDates('2026-02-30'), RangeError);
  assert.throws(() => shiftDate('2026-10-20', 0.5), RangeError);
});

test('status distinguishes records, blank rollover days, ongoing days and the future', () => {
  assert.equal(islandSummary(undefined, '2026-10-19', today).status, 'incomplete');
  assert.equal(islandSummary(day([], { started: false }), '2026-10-19', today).status, 'incomplete');
  assert.equal(islandSummary(day(tasks(2, 2), { ended: false }), today, today).status, 'incomplete');
  assert.equal(islandSummary(day(tasks(2, 2), { started: false }), '2026-10-19', today).status, 'completed');
  const future = islandSummary(day(tasks(2, 2)), '2026-10-21', today);
  assert.equal(future.status, 'future');
  assert.equal(future.stars, 0);
  assert.equal(islandSummary(day([], { started: false }), today, today).recorded, false);
});

test('stars honor exact thresholds, zero completion, settlement, and the S-task ceiling', () => {
  const stars = (total, done, sDone = true) => islandSummary(day(tasks(total, done, sDone)), today, today).stars;
  assert.equal(stars(0, 0), 0);
  assert.equal(stars(5, 0), 0);
  assert.equal(stars(5, 1), 1);
  assert.equal(stars(5, 2), 1);
  assert.equal(stars(5, 3), 2);
  assert.equal(stars(5, 4), 2);
  assert.equal(stars(5, 5), 3);
  assert.equal(stars(5, 4, false), 1);
  assert.equal(islandSummary(day([{ grade: 'A', done: true }]), today, today).stars, 1);
  assert.equal(islandSummary(day(tasks(2, 2), { ended: false }), today, today).stars, 0);
});

test('dashboard excludes future and blank archived days and calculates weighted task and grade ratios', () => {
  const db = { days: {
    '2026-10-15': day([], { started: false }),
    '2026-10-16': day([{ grade: 'S', done: true }, { grade: 'A', done: true }]),
    '2026-10-17': day([{ grade: 'S', done: false }, { grade: 'A', done: true }, { grade: 'F', done: true }]),
    '2026-10-18': day([{ grade: 'S', done: false }]),
    '2026-10-20': day([{ grade: 'S', done: true }, { grade: 'B', done: false }], { ended: false }),
    '2026-10-21': day([{ grade: 'S', done: true }])
  } };
  const before = JSON.stringify(db);
  const stats = dashboard(db, today);
  assert.equal(stats.completedDays, 3);
  assert.equal(stats.recordedDays, 4);
  assert.equal(stats.completedTasks, 5);
  assert.equal(stats.totalTasks, 8);
  assert.equal(stats.completionRate, 5 / 8);
  assert.equal(stats.stars, 4);
  assert.equal(stats.perfectDays, 1);
  assert.deepEqual(stats.starCounts, [1, 1, 0, 1]);
  assert.deepEqual(stats.grades, [
    { grade: 'S', total: 4, done: 2, ratio: 0.5 },
    { grade: 'A', total: 2, done: 2, ratio: 1 },
    { grade: 'B', total: 1, done: 0, ratio: 0 },
    { grade: 'C', total: 0, done: 0, ratio: 0 },
    { grade: 'F', total: 1, done: 1, ratio: 1 }
  ]);
  assert.equal(JSON.stringify(db), before);
});

test('late completion updates earned stars and history totals without mutating the record', () => {
  const record = day([{ grade: 'S', done: false }, { grade: 'A', done: true }]);
  const db = { days: { '2026-10-19': record } };
  assert.equal(dashboard(db, today).stars, 1);
  record.tasks[0].done = true;
  assert.equal(dashboard(db, today).stars, 3);
  assert.equal(dashboard(db, today).perfectDays, 1);
  const empty = dashboard({ days: {} }, today);
  assert.equal(empty.completionRate, 0);
  assert.deepEqual(empty.starCounts, [0, 0, 0, 0]);
  assert.ok(empty.grades.every(grade => grade.ratio === 0));
});

