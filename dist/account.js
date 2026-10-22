import {accountBackend, accountErrorMessage} from './account-backend.js';
import {createCloudSync, BACKUP_KEY} from './cloud-sync.js';

let savedLocally = () => {};
let resetLocally = () => {};
export function noteLocalSave() { try { savedLocally(); } catch {} }
export function prepareLocalReset() { resetLocally(); }

export function initAccount({storageKey, backend = accountBackend}) {
  const $ = id => document.getElementById(id), dialog = $('accountDialog');
  let mode = 'signIn', session = null, busy = false, authRevision = 0, syncTimer;
  const cloud = createCloudSync({backend, storage: localStorage, storageKey, onState: renderSync});
  resetLocally = () => cloud.prepareLocalReset();
  function renderSync(state) {
    const labels = {guest: '访客 · 登录后可传输本地记录', pending: '本地记录：待传输', syncing: '本地已保存 · 正在传输', synced: '已上传云端 · 本地保留', conflict: '本地与云端记录不同 · 待选择', 'other-account': '此浏览器记录属于其他账户 · 待选择'};
    $('accountSyncStatus').textContent = labels[state.status];
    $('accountButton').dataset.sync = state.status;
    $('accountButton').setAttribute('aria-label', `账户，${labels[state.status]}`);
    $('accountConflict').hidden = !state.conflict;
    $('accountUseCloud').disabled = !state.conflict?.remote;
    $('accountUseLocal').disabled = Boolean(state.conflict?.foreign) || !state.conflict?.remote;
    $('accountConflictText').textContent = state.conflict?.foreign
      ? '为避免把其他账户的记录上传到当前账户，自动传输已暂停。可以使用当前账户的云端记录，或退出后登录原账户。本地替换前会保留备份。'
      : '请选用一份记录。替换前会在此浏览器保留一份备份；使用云端记录后页面会刷新。';
    if (state.error) $('accountMessage').textContent = accountErrorMessage(state.error);
    refreshBackup();
  }
  function refreshBackup() { try { $('accountBackup').hidden = !localStorage.getItem(BACKUP_KEY); } catch { $('accountBackup').hidden = true; } }
  function setBusy(value) {
    busy = value;
    for (const id of ['accountSubmit', 'accountSignInTab', 'accountSignUpTab', 'accountSignOut', 'accountRetry']) $(id).disabled = value;
  }
  function setMode(next) {
    if (busy) return;
    mode = next;
    $('accountSignInTab').setAttribute('aria-selected', String(next === 'signIn'));
    $('accountSignUpTab').setAttribute('aria-selected', String(next === 'signUp'));
    $('accountNicknameField').hidden = next !== 'signUp';
    $('accountPassword').setAttribute('autocomplete', next === 'signUp' ? 'new-password' : 'current-password');
    $('accountPassword').setAttribute('minlength', next === 'signUp' ? '8' : '1');
    $('accountSubmit').textContent = next === 'signUp' ? '注册' : '登录';
    $('accountMessage').textContent = backend.configured ? (next === 'signUp' ? '注册后请检查邮箱中的确认邮件。' : '登录后可将此浏览器的记录保存到你的云端账户。') : '账户服务待连接；本地记录待传输。';
    $('accountPassword').value = '';
  }
  function setSession(next) {
    const previousId = session?.user?.id;
    session = next?.user?.id ? next : null;
    $('accountForm').hidden = Boolean(session);
    $('accountTabs').hidden = Boolean(session);
    $('accountSession').hidden = !session;
    $('accountGuest').textContent = session ? '返回岛屿' : '继续作为访客';
    if (session) {
      $('accountIdentity').textContent = session.user.email || session.user.user_metadata?.display_name || '已登录';
      $('accountPassword').value = '';
      if (previousId !== session.user.id) $('accountMessage').textContent = '已登录。本地保存始终可用；退出登录会保留此浏览器的记录。';
    } else if (previousId) $('accountMessage').textContent = '已退出登录，本地记录保留在此浏览器。';
    cloud.connect(session);
  }
  savedLocally = () => {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => { void cloud.sync(); }, 500);
  };
  const close = () => { $('accountPassword').value = ''; dialog.close(); $('accountButton').focus(); };
  $('accountButton').addEventListener('click', () => { refreshBackup(); dialog.showModal(); (session ? $('accountRetry') : $('accountEmail')).focus(); });
  $('accountClose').addEventListener('click', close);
  $('accountGuest').addEventListener('click', close);
  dialog.addEventListener('close', () => { $('accountPassword').value = ''; });
  dialog.addEventListener('cancel', () => { $('accountPassword').value = ''; });
  $('accountSignInTab').addEventListener('click', () => setMode('signIn'));
  $('accountSignUpTab').addEventListener('click', () => setMode('signUp'));
  $('accountForm').addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    const email = $('accountEmail').value.trim();
    let password = $('accountPassword').value;
    const username = $('accountUsername').value.trim().slice(0, 40);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < (mode === 'signUp' ? 8 : 1)) {
      $('accountMessage').textContent = mode === 'signUp' ? '请输入有效邮箱，以及至少 8 位的密码。' : '请输入有效邮箱和密码。'; return;
    }
    $('accountPassword').value = '';
    if (!backend.configured) {
      password = '';
      $('accountMessage').textContent = '待传输：账户服务尚未连接，尚未完成登录或注册。连接后请重新填写。'; return;
    }
    const revision = ++authRevision, action = mode;
    setBusy(true);
    try {
      const result = await backend[action]({email, password, username});
      if (revision !== authRevision) return;
      if (result?.session?.user?.id) setSession(result.session);
      else $('accountMessage').textContent = action === 'signUp' ? '如果此邮箱可以注册，你会收到确认邮件。请打开邮件中的链接，再回来登录。' : '尚未完成登录，请稍后重试。';
    } catch (error) { if (revision === authRevision) $('accountMessage').textContent = accountErrorMessage(error); }
    finally { password = ''; setBusy(false); }
  });
  $('accountSignOut').addEventListener('click', async () => {
    if (busy) return;
    ++authRevision; setBusy(true); cloud.connect(null);
    try { await backend.signOut(); setSession(null); }
    catch (error) { $('accountMessage').textContent = accountErrorMessage(error); cloud.connect(session); }
    finally { setBusy(false); }
  });
  $('accountRetry').addEventListener('click', () => { void cloud.sync(); });
  for (const [id, choice] of [['accountUseLocal', 'local'], ['accountUseCloud', 'cloud']]) $(id).addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    try { if (await cloud.resolveConflict(choice)) window.location.reload(); }
    finally { setBusy(false); }
  });
  function download(backup = false) {
    try {
      const raw = localStorage.getItem(backup ? BACKUP_KEY : storageKey);
      if (!raw) { $('accountMessage').textContent = '当前没有可导出的存档。'; return; }
      const payload = backup ? JSON.parse(raw).snapshot : JSON.parse(raw);
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'}));
      const link = document.createElement('a'); link.href = url; link.download = backup ? 'daily-island-backup.json' : 'daily-island-save.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { $('accountMessage').textContent = '导出未完成，请保留当前页面并重试。'; }
  }
  $('accountExport').addEventListener('click', () => download());
  $('accountBackup').addEventListener('click', () => download(true));
  window.addEventListener('online', () => { void cloud.sync(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void cloud.sync(); });
  setMode('signIn'); renderSync(cloud.state);
  if (backend.configured) {
    const revision = authRevision;
    void (async () => {
      await backend.watchSession(setSession);
      const restored = await backend.restoreSession();
      if (revision === authRevision) setSession(restored);
    })().catch(error => { $('accountMessage').textContent = accountErrorMessage(error); });
  }
  return cloud;
}
