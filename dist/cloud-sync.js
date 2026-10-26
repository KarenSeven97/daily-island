import {freshDB, pickTile, validateDB} from './model.js';

export const SYNC_KEY = 'daily-island-sync-v1';
export const BACKUP_KEY = 'daily-island-backup-v1';
const MISSING = Symbol('missing');
const clone = value => JSON.parse(JSON.stringify(value));
const stable = value => JSON.stringify(value, function (_key, item) {
  return item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item;
});
const same = (left, right) => left === MISSING || right === MISSING
  ? left === right : stable(left) === stable(right);
const valid = value => validateDB(clone(value));
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const valueAt = (value, key) => object(value) && Object.hasOwn(value, key) ? value[key] : MISSING;

function mergeValue(base, local, remote) {
  if (same(local, remote)) return {ok: true, value: local};
  if (same(local, base)) return {ok: true, value: remote};
  if (same(remote, base)) return {ok: true, value: local};
  if (object(local) && object(remote) && (object(base) || base === MISSING)) {
    const merged = {}, keys = new Set([
      ...Object.keys(object(base) ? base : {}), ...Object.keys(local), ...Object.keys(remote)
    ]);
    for (const key of [...keys].sort()) {
      const result = mergeValue(valueAt(base, key), valueAt(local, key), valueAt(remote, key));
      if (!result.ok) return result;
      if (result.value !== MISSING) merged[key] = result.value;
    }
    return {ok: true, value: merged};
  }
  return {ok: false};
}

function keyed(items = [], key) {
  return new Map(items.map(item => [item[key], item]));
}

function mergeTasks(base = [], local = [], remote = []) {
  const maps = [keyed(base, 'id'), keyed(local, 'id'), keyed(remote, 'id')];
  const ids = new Set(maps.flatMap(map => [...map.keys()])), merged = new Map();
  for (const id of ids) {
    const result = mergeValue(...maps.map(map => map.has(id) ? map.get(id) : MISSING));
    if (!result.ok) return result;
    if (result.value !== MISSING) merged.set(id, result.value);
  }
  const baseOrder = base.map(task => task.id).filter(id => merged.has(id));
  const added = [...merged.values()].filter(task => !baseOrder.includes(task.id)).sort((a, b) =>
    String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || a.id.localeCompare(b.id));
  return {ok: true, value: [...baseOrder.map(id => merged.get(id)), ...added]};
}

function mergeTiles(base = [], local = [], remote = [], tasks) {
  const maps = [keyed(base, 'taskId'), keyed(local, 'taskId'), keyed(remote, 'taskId')];
  const candidates = new Map();
  for (const task of tasks.filter(item => item.done)) {
    const id = task.id;
    const result = mergeValue(...maps.map(map => map.has(id) ? map.get(id) : MISSING));
    if (!result.ok) return result;
    if (result.value !== MISSING) candidates.set(id, result.value);
  }
  const baseOrder = base.map(tile => tile.taskId).filter(id => candidates.has(id));
  const remaining = tasks.filter(task => task.done && !baseOrder.includes(task.id)).sort((a, b) =>
    String(a.recordedAt || a.completedAt || a.createdAt || '').localeCompare(String(b.recordedAt || b.completedAt || b.createdAt || '')) || a.id.localeCompare(b.id));
  const order = [...baseOrder.map(id => tasks.find(task => task.id === id)), ...remaining];
  const output = [], occupied = new Set(['0,0']);
  for (const task of order) {
    const candidate = candidates.get(task.id);
    const position = candidate && Number.isInteger(candidate.x) && Number.isInteger(candidate.y)
      ? {x: candidate.x, y: candidate.y} : null;
    const open = position && !occupied.has(`${position.x},${position.y}`);
    const adjacent = open && [[1,0],[0,1],[-1,0],[0,-1]].some(([x, y]) => occupied.has(`${position.x + x},${position.y + y}`));
    const point = adjacent ? position : pickTile({tiles: output}, task.grade, task.id);
    const tile = {...(candidate || {}), ...point, taskId: task.id, grade: task.grade,
      createdAt: candidate?.createdAt || task.recordedAt || task.completedAt || task.createdAt};
    output.push(tile); occupied.add(`${point.x},${point.y}`);
  }
  return {ok: true, value: output};
}

function emptyDay(date) {
  return {date, themeId: null, started: false, ended: false, settledAt: null, tasks: [], tiles: []};
}

function mergeDay(date, base, local, remote) {
  if (same(local, remote)) return {ok: true, value: local};
  if (same(local, base)) return {ok: true, value: remote};
  if (same(remote, base)) return {ok: true, value: local};
  if (local === MISSING || remote === MISSING) return {ok: false};
  const foundation = base === MISSING ? emptyDay(date) : base;
  const tasks = mergeTasks(foundation.tasks, local.tasks, remote.tasks);
  if (!tasks.ok) return tasks;
  const day = {}, keys = new Set([...Object.keys(foundation), ...Object.keys(local), ...Object.keys(remote)]);
  keys.delete('tasks'); keys.delete('tiles');
  for (const key of [...keys].sort()) {
    let result = mergeValue(valueAt(foundation, key), valueAt(local, key), valueAt(remote, key));
    if (!result.ok && (key === 'startedAt' || key === 'settledAt')) {
      const values = [local[key], remote[key]].filter(value => value && Number.isFinite(Date.parse(value))).sort();
      if (values.length) result = {ok: true, value: values[0]};
    }
    if (!result.ok) return result;
    if (result.value !== MISSING) day[key] = result.value;
  }
  day.tasks = tasks.value;
  const tiles = mergeTiles(foundation.tiles, local.tiles, remote.tiles, day.tasks);
  if (!tiles.ok) return tiles;
  day.tiles = tiles.value;
  if (day.started && day.tasks.filter(task => task.grade === 'S').length !== 1) return {ok: false};
  return {ok: true, value: day};
}

export function mergeSnapshots(base, local, remote) {
  try {
    base = valid(base); local = valid(local); remote = valid(remote);
    if (same(local, remote)) return {ok: true, snapshot: local};
    if (same(local, base)) return {ok: true, snapshot: remote};
    if (same(remote, base)) return {ok: true, snapshot: local};
    const result = {schemaVersion: 1, days: {}, preferences: {}};
    const dates = new Set([...Object.keys(base.days), ...Object.keys(local.days), ...Object.keys(remote.days)]);
    for (const date of [...dates].sort()) {
      const day = mergeDay(date, valueAt(base.days, date), valueAt(local.days, date), valueAt(remote.days, date));
      if (!day.ok) return {ok: false};
      if (day.value !== MISSING) result.days[date] = day.value;
    }
    const preferences = mergeValue(base.preferences, local.preferences, remote.preferences);
    if (!preferences.ok) return {ok: false};
    result.preferences = preferences.value;
    const extra = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
    for (const key of ['schemaVersion', 'days', 'preferences']) extra.delete(key);
    for (const key of [...extra].sort()) {
      const value = mergeValue(valueAt(base, key), valueAt(local, key), valueAt(remote, key));
      if (!value.ok) return {ok: false};
      if (value.value !== MISSING) result[key] = value.value;
    }
    return {ok: true, snapshot: valid(result)};
  } catch {
    return {ok: false};
  }
}

const blank = snapshot => Object.values(snapshot.days).every(day =>
  !day.started && !day.ended && day.tasks.length === 0 && day.tiles.length === 0);

// Local writes stay immediate. A saved base snapshot enables three-way merging,
// while server-side version filtering remains the final concurrent-write guard.
export function createCloudSync({backend, storage, storageKey, onState = () => {}, onLocalChange = () => {}, withLock = task => task()}) {
  let userId = null, generation = 0, running = null, requested = false, resolving = false;
  let state = {status: 'guest', conflict: null};
  const emit = next => { state = {conflict: null, ...next}; onState(state); };
  const local = () => { const raw = storage.getItem(storageKey); return raw ? valid(JSON.parse(raw)) : null; };
  const checkpoint = () => { try { return JSON.parse(storage.getItem(SYNC_KEY) || 'null'); } catch { return null; } };
  const remember = (id, version, base, requiresChoice = false) => storage.setItem(SYNC_KEY, JSON.stringify({userId: id, version, base, ...(requiresChoice ? {requiresChoice: true} : {})}));
  const backup = (source, id, snapshot) => storage.setItem(BACKUP_KEY, JSON.stringify({source, userId: id, savedAt: new Date().toISOString(), snapshot}));
  const current = (id, token) => id === userId && token === generation;
  const applyLocal = snapshot => { storage.setItem(storageKey, JSON.stringify(snapshot)); onLocalChange(snapshot); };
  function conflict(remote, foreign = false) {
    emit({status: foreign ? 'other-account' : 'conflict', conflict: {remote, foreign}});
  }
  async function attempt() {
    const id = userId, token = generation;
    try {
      const remote = await backend.readSave(id);
      if (!current(id, token)) return;
      if (remote) valid(remote.snapshot);
      const snapshot = local();
      if (!snapshot) { emit({status: 'pending'}); return; }
      const saved = checkpoint();
      if (saved?.userId && saved.userId !== id) { conflict(remote, true); return; }
      if (remote && same(remote.snapshot, snapshot)) {
        remember(id, remote.version, snapshot); emit({status: 'synced'}); return;
      }
      if (remote && saved?.requiresChoice) { conflict(remote); return; }
      if (remote && !saved?.userId) {
        if (!blank(snapshot)) { conflict(remote); return; }
        const merged = mergeSnapshots(freshDB(), snapshot, remote.snapshot);
        if (!merged.ok) { conflict(remote); return; }
        remember(id, remote.version, remote.snapshot);
        applyLocal(merged.snapshot); emit({status: 'synced'}); return;
      }
      let upload = snapshot;
      if (remote && saved?.base) {
        const merged = mergeSnapshots(saved.base, snapshot, remote.snapshot);
        if (!merged.ok) { conflict(remote); return; }
        upload = merged.snapshot;
        if (same(upload, remote.snapshot)) {
          remember(id, remote.version, remote.snapshot);
          if (!same(upload, snapshot)) applyLocal(upload);
          emit({status: 'synced'}); return;
        }
      } else if (remote && saved?.version !== remote.version) {
        conflict(remote); return;
      }
      emit({status: 'syncing'});
      const before = snapshot;
      const result = await backend.writeSave(id, upload, remote?.version ?? null);
      if (!current(id, token)) return;
      if (result.conflict) { requested = true; return; }
      remember(id, result.version, upload);
      const latestLocal = local();
      if (same(latestLocal, before)) {
        if (!same(upload, before)) applyLocal(upload);
      } else {
        const followup = mergeSnapshots(before, latestLocal, upload);
        if (!followup.ok) { conflict({snapshot: upload, version: result.version}); return; }
        if (!same(followup.snapshot, latestLocal)) applyLocal(followup.snapshot);
        if (!same(followup.snapshot, upload)) requested = true;
      }
      emit({status: requested ? 'syncing' : 'synced'});
    } catch (error) {
      if (current(id, token)) emit({status: 'pending', error});
    }
  }
  async function sync() {
    if (!userId) { emit({status: 'guest'}); return; }
    requested = true;
    if (resolving) return;
    if (running) return running;
    running = (async () => { while (requested && userId) { requested = false; await withLock(attempt); } })();
    try { await running; } finally { running = null; if (requested && userId) void sync(); }
  }
  async function resolveConflict(choice) {
    if (!userId || !state.conflict || running || resolving) return false;
    const id = userId, token = generation, shown = state.conflict;
    if (choice === 'local' && shown.foreign) return false;
    resolving = true;
    try {
      const remote = await backend.readSave(id);
      if (!current(id, token)) return false;
      if (!remote || remote.version !== shown.remote?.version) { conflict(remote, shown.foreign); return false; }
      const cloud = valid(remote.snapshot), snapshot = local();
      if (choice === 'cloud') {
        if (snapshot) backup('local', checkpoint()?.userId || null, snapshot);
        remember(id, remote.version, cloud);
        applyLocal(cloud); emit({status: 'synced'});
        return true;
      }
      if (choice !== 'local' || !snapshot) return false;
      backup('cloud', id, cloud);
      emit({status: 'syncing'});
      const result = await backend.writeSave(id, snapshot, remote.version);
      if (!current(id, token)) return false;
      if (result.conflict) {
        const latest = await backend.readSave(id);
        if (current(id, token)) conflict(latest);
        return false;
      }
      remember(id, result.version, snapshot); emit({status: 'synced'});
      if (!same(local(), snapshot)) requested = true;
      return false;
    } catch (error) {
      if (current(id, token)) emit({status: 'pending', error});
      return false;
    } finally {
      resolving = false;
      if (requested && userId) void sync();
    }
  }
  return {
    get state() { return state; },
    prepareLocalReset() {
      const saved = checkpoint();
      if (userId || saved?.userId) remember(userId || saved.userId, null, saved?.base || null, true);
      generation++; requested = false;
      emit({status: userId ? 'pending' : 'guest'});
    },
    connect(session) {
      const next = session?.user?.id || null;
      if (next === userId) return;
      userId = next; generation++; requested = false;
      emit({status: next ? 'pending' : 'guest'});
      if (next) void sync();
    },
    sync,
    resolveConflict
  };
}
