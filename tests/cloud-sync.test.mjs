import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudSync, SYNC_KEY, BACKUP_KEY} from '../dist/cloud-sync.js';
import {freshDB, ensureDay, addTask} from '../dist/model.js';
const KEY = 'daily-island-v1', clone = value => JSON.parse(JSON.stringify(value));
const session = id => ({user: {id}});
function record(name) { const db=freshDB(); addTask(ensureDay(db,'2026-10-23'),name,'S'); return db; }
function setup({local=record('本地计划'), remote=null, checkpoint=null}={}) {
  const values=new Map([[KEY,JSON.stringify(local)]]);
  if(checkpoint)values.set(SYNC_KEY,JSON.stringify(checkpoint));
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const requests=[]; let row=clone(remote);
  const backend={
    async readSave(id){requests.push(['read',id]);return clone(row);},
    async writeSave(id,snapshot,version){
      requests.push(['write',id,clone(snapshot),version]);
      if((row?.version??null)!==version)return {conflict:true};
      row={snapshot:clone(snapshot),version:(row?.version??0)+1};
      return {conflict:false,version:row.version};
    }
  };
  const sync=createCloudSync({backend,storage,storageKey:KEY});
  return {sync,storage,values,backend,requests,get row(){return row;},set row(value){row=clone(value);}};
}

test('guest saves never cause a cloud request',async()=>{
  const h=setup();await h.sync.sync();assert.equal(h.requests.length,0);assert.equal(h.sync.state.status,'guest');
});
test('first authenticated upload keeps local data and records server version',async()=>{
  const h=setup(),before=h.values.get(KEY);h.sync.connect(session('alice'));await h.sync.sync();
  assert.equal(h.sync.state.status,'synced');assert.equal(h.values.get(KEY),before);
  assert.deepEqual(JSON.parse(h.values.get(SYNC_KEY)),{userId:'alice',version:1});
  assert.deepEqual(h.row.snapshot,JSON.parse(before));
});
test('a matching checkpoint permits later local edits, but changed cloud version requires a choice',async()=>{
  const h=setup({remote:{snapshot:record('旧计划'),version:2},checkpoint:{userId:'alice',version:2}});
  h.sync.connect(session('alice'));await h.sync.sync();assert.equal(h.row.version,3);
  const cloud=record('另一设备的新计划');h.row={snapshot:cloud,version:4};
  await h.sync.sync();assert.equal(h.sync.state.status,'conflict');assert.deepEqual(h.row.snapshot,cloud);
});
test('blank browser never silently overwrites an existing cloud island',async()=>{
  const h=setup({local:freshDB(),remote:{snapshot:record('云端计划'),version:7}});
  h.sync.connect(session('alice'));await h.sync.sync();assert.equal(h.sync.state.status,'conflict');
  assert.equal(h.requests.filter(r=>r[0]==='write').length,0);
});
test('choosing cloud backs up local first, validates and replaces only the local save',async()=>{
  const h=setup({remote:{snapshot:record('云端计划'),version:3}}),before=h.values.get(KEY);
  h.sync.connect(session('alice'));await h.sync.sync();assert.equal(await h.sync.resolveConflict('cloud'),true);
  assert.deepEqual(JSON.parse(h.values.get(BACKUP_KEY)).snapshot,JSON.parse(before));
  assert.deepEqual(JSON.parse(h.values.get(KEY)),h.row.snapshot);assert.equal(h.row.version,3);
});
test('choosing local backs up cloud and uses the displayed version; new remote edits block it',async()=>{
  const h=setup({remote:{snapshot:record('云端计划'),version:3}});
  h.sync.connect(session('alice'));await h.sync.sync();h.row={snapshot:record('更晚的云端计划'),version:4};
  await h.sync.resolveConflict('local');assert.equal(h.row.version,4);assert.equal(h.sync.state.status,'conflict');
  const latest=clone(h.row.snapshot);await h.sync.resolveConflict('local');
  assert.deepEqual(JSON.parse(h.values.get(BACKUP_KEY)).snapshot,latest);
  assert.equal(h.row.version,5);assert.deepEqual(h.row.snapshot,JSON.parse(h.values.get(KEY)));
});
test('another account cannot receive this browser owner’s records automatically or via local override',async()=>{
  const h=setup({checkpoint:{userId:'alice',version:2},remote:{snapshot:record('Bob 的计划'),version:1}});
  h.sync.connect(session('bob'));await h.sync.sync();assert.equal(h.sync.state.status,'other-account');
  await h.sync.resolveConflict('local');assert.equal(h.requests.filter(r=>r[0]==='write').length,0);
  assert.equal(await h.sync.resolveConflict('cloud'),true);
  assert.equal(JSON.parse(h.values.get(BACKUP_KEY)).userId,'alice');
  assert.equal(JSON.parse(h.values.get(SYNC_KEY)).userId,'bob');
});
test('failed network leaves local records intact and manual retry succeeds',async()=>{
  const h=setup(),before=h.values.get(KEY),read=h.backend.readSave;
  h.backend.readSave=async()=>{throw new TypeError('offline');};h.sync.connect(session('alice'));await h.sync.sync();
  assert.equal(h.sync.state.status,'pending');assert.equal(h.values.get(KEY),before);
  h.backend.readSave=read;await h.sync.sync();assert.equal(h.sync.state.status,'synced');
});
test('backup storage failure prevents replacing a local record',async()=>{
  const h=setup({remote:{snapshot:record('云端计划'),version:1}}),before=h.values.get(KEY);
  h.sync.connect(session('alice'));await h.sync.sync();const write=h.storage.setItem;
  h.storage.setItem=(key,value)=>{if(key===BACKUP_KEY)throw new DOMException('full','QuotaExceededError');write(key,value);};
  assert.equal(await h.sync.resolveConflict('cloud'),false);assert.equal(h.values.get(KEY),before);
});
test('invalid cloud records are rejected without changing local data',async()=>{
  const h=setup({remote:{snapshot:{schemaVersion:99},version:1}}),before=h.values.get(KEY);
  h.sync.connect(session('alice'));await h.sync.sync();assert.equal(h.sync.state.status,'pending');
  assert.equal(h.values.get(KEY),before);assert.equal(h.requests.filter(r=>r[0]==='write').length,0);
});
test('signing out during a request prevents stale status and ownership changes',async()=>{
  const h=setup();let finish;h.backend.readSave=()=>new Promise(resolve=>{finish=resolve;});
  h.sync.connect(session('alice'));const pending=h.sync.sync();h.sync.connect(null);finish(null);await pending;
  assert.equal(h.sync.state.status,'guest');assert.equal(h.values.has(SYNC_KEY),false);
  assert.equal(h.requests.filter(r=>r[0]==='write').length,0);
});
test('a save made during an upload is sent after it, in order',async()=>{
  const h=setup(),write=h.backend.writeSave;let finish,first=true;
  h.backend.writeSave=async(...args)=>{if(first){first=false;await new Promise(resolve=>{finish=resolve;});}return write(...args);};
  h.sync.connect(session('alice'));const pending=h.sync.sync();await new Promise(setImmediate);
  const newer=record('上传期间的新计划');h.storage.setItem(KEY,JSON.stringify(newer));finish();await pending;
  assert.deepEqual(h.row.snapshot,newer);assert.equal(h.row.version,2);
});

test('local debug reset pauses automatic overwrites of an existing cloud record',async()=>{
  const h=setup();h.sync.connect(session('alice'));await h.sync.sync();const before=clone(h.row);
  h.sync.prepareLocalReset();h.storage.setItem(KEY,JSON.stringify(freshDB()));await h.sync.sync();
  assert.deepEqual(h.row,before);assert.equal(h.sync.state.status,'conflict');
});

test('reset during an upload discards the stale checkpoint before the empty save can upload',async()=>{
  const h=setup(),write=h.backend.writeSave;let finish;
  h.backend.writeSave=async(...args)=>{await new Promise(resolve=>{finish=resolve;});return write(...args);};
  h.sync.connect(session('alice'));const pending=h.sync.sync();await new Promise(setImmediate);
  const original=JSON.parse(h.values.get(KEY));h.sync.prepareLocalReset();h.storage.setItem(KEY,JSON.stringify(freshDB()));
  void h.sync.sync();finish();await pending;
  assert.deepEqual(h.row.snapshot,original);assert.equal(h.sync.state.status,'conflict');
});
