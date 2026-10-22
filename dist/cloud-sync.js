import {validateDB} from './model.js';

export const SYNC_KEY = 'daily-island-sync-v1';
export const BACKUP_KEY = 'daily-island-backup-v1';
const stable = value => JSON.stringify(value, function (_key, item) {
  return item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item;
});
const valid = value => validateDB(JSON.parse(JSON.stringify(value)));

// Local records remain authoritative until the user explicitly chooses a cloud copy.
// A saved checkpoint plus server-side version filtering prevents blind overwrites.
export function createCloudSync({backend, storage, storageKey, onState = () => {}}) {
  let userId = null, generation = 0, running = null, requested = false, resolving = false;
  let state = {status: 'guest', conflict: null};
  const emit = next => { state = {conflict: null, ...next}; onState(state); };
  const local = () => { const raw = storage.getItem(storageKey); return raw ? valid(JSON.parse(raw)) : null; };
  const checkpoint = () => { try { return JSON.parse(storage.getItem(SYNC_KEY) || 'null'); } catch { return null; } };
  const remember = (id, version) => storage.setItem(SYNC_KEY, JSON.stringify({userId: id, version}));
  const backup = (source, id, snapshot) => storage.setItem(BACKUP_KEY, JSON.stringify({source, userId: id, savedAt: new Date().toISOString(), snapshot}));
  const current = (id, token) => id === userId && token === generation;
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
      if (remote && stable(remote.snapshot) === stable(snapshot)) {
        remember(id, remote.version); emit({status: 'synced'}); return;
      }
      if (remote && (saved?.userId !== id || saved.version !== remote.version)) { conflict(remote); return; }
      emit({status: 'syncing'});
      const result = await backend.writeSave(id, snapshot, remote?.version ?? null);
      if (!current(id, token)) return;
      if (result.conflict) {
        const latest = await backend.readSave(id);
        if (current(id, token)) conflict(latest);
        return;
      }
      remember(id, result.version);
      emit({status: 'synced'});
      // A change made during upload is still in localStorage and gets a new pass.
      if (stable(local()) !== stable(snapshot)) requested = true;
    } catch (error) {
      if (current(id, token)) emit({status: 'pending', error});
    }
  }
  async function sync() {
    if (!userId) { emit({status: 'guest'}); return; }
    requested = true;
    if (resolving) return;
    if (running) return running;
    running = (async () => { while (requested && userId) { requested = false; await attempt(); } })();
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
        storage.setItem(storageKey, JSON.stringify(cloud));
        // If metadata storage fails, equality checking on reload still protects the cloud.
        try { remember(id, remote.version); } catch {}
        emit({status: 'synced'});
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
      remember(id, result.version); emit({status: 'synced'});
      if (stable(local()) !== stable(snapshot)) requested = true;
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
      if (saved?.userId) remember(saved.userId, null);
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
