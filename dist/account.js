import {accountBackend} from './account-backend.js';

let savedLocally = () => {};

// The island keeps localStorage as its primary save path. Cloud transfer is optional.
export function noteLocalSave(snapshot) { savedLocally(snapshot); }

export function initAccount({storageKey, backend = accountBackend}) {
  const $ = id => document.getElementById(id);
  const dialog = $('accountDialog'), form = $('accountForm');
  let mode = 'signIn', session = null, syncQueue = Promise.resolve();

  function hasLocalRecord() {
    try { return Boolean(localStorage.getItem(storageKey)); }
    catch { return false; }
  }
  function showSyncStatus(label) {
    $('accountSyncStatus').textContent = label || `本地记录：${hasLocalRecord() ? '待传输' : '暂无可传输记录'}`;
  }
  function setMode(next) {
    mode = next;
    $('accountSignInTab').setAttribute('aria-selected', String(next === 'signIn'));
    $('accountSignUpTab').setAttribute('aria-selected', String(next === 'signUp'));
    $('accountPassword').setAttribute('autocomplete', next === 'signUp' ? 'new-password' : 'current-password');
    $('accountSubmit').textContent = next === 'signUp' ? '注册' : '登录';
    $('accountMessage').textContent = backend.configured ? '登录后可以传输当前浏览器的岛屿记录。' : '账户服务待连接；此处不会创建或验证账号。';
    $('accountPassword').value = '';
  }
  function queueSync(snapshot) {
    if (!backend.configured || !session || !snapshot) return;
    // Serialize uploads so a slower earlier save cannot overwrite a newer save.
    const copy = JSON.parse(JSON.stringify(snapshot));
    showSyncStatus('本地已保存 · 正在传输');
    syncQueue = syncQueue.catch(() => {}).then(async () => {
      try {
        const result = await backend.syncLocal({session, snapshot: copy});
        showSyncStatus(result?.status === 'synced' ? '本地已保存 · 云端已同步' : '本地记录：待传输');
      } catch {
        showSyncStatus('本地已保存 · 云端待传输');
      }
    });
  }
  savedLocally = queueSync;

  $('accountButton').addEventListener('click', () => {
    showSyncStatus();
    dialog.showModal();
    $('accountUsername').focus();
  });
  $('accountClose').addEventListener('click', () => dialog.close());
  $('accountGuest').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { $('accountPassword').value = ''; $('accountButton').focus(); });
  dialog.addEventListener('cancel', () => { $('accountPassword').value = ''; });
  $('accountSignInTab').addEventListener('click', () => setMode('signIn'));
  $('accountSignUpTab').addEventListener('click', () => setMode('signUp'));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const username = $('accountUsername').value.trim();
    const password = $('accountPassword').value;
    if (!username || password.length < 8) {
      $('accountMessage').textContent = '请输入用户名，以及至少 8 位的密码。';
      return;
    }
    if (!backend.configured) {
      $('accountPassword').value = '';
      $('accountMessage').textContent = '待传输：账户服务尚未连接，尚未完成登录或注册。密码已清除；连接后请重新填写，岛屿记录会继续保存在本地。';
      showSyncStatus();
      return;
    }
    $('accountSubmit').disabled = true;
    try {
      const result = await backend[mode]({username, password});
      $('accountPassword').value = '';
      session = result?.session?.user?.id ? result.session : null;
      if (session) {
        $('accountMessage').textContent = `已登录：${username}`;
        const raw = localStorage.getItem(storageKey);
        if (raw) queueSync(JSON.parse(raw));
      } else {
        $('accountMessage').textContent = result?.message || '尚未完成身份验证，本地记录仍可继续使用。';
        showSyncStatus();
      }
    } catch {
      $('accountPassword').value = '';
      $('accountMessage').textContent = '账户操作未完成；本地记录不受影响。';
      showSyncStatus();
    } finally {
      $('accountSubmit').disabled = false;
    }
  });

  if (backend.configured) backend.restoreSession().then(restored => {
    session = restored?.user?.id ? restored : null;
    if (session) {
      $('accountMessage').textContent = '账户已连接，本地记录仍保存在此浏览器。';
      try { const raw = localStorage.getItem(storageKey); if (raw) queueSync(JSON.parse(raw)); } catch {}
    }
  }).catch(() => {});
}

