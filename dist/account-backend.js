import {supabaseConfig} from './supabase-config.js';

let clientPromise;
export async function getSupabaseClient() {
  if (!clientPromise) clientPromise = import('./supabase-sdk.js').then(({supabase}) =>
    supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
      auth: {storageKey: 'daily-island-auth-v1', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true},
      global: {fetch: (url, options = {}) => fetch(url, {...options, signal: options.signal || AbortSignal.timeout(15000)})}
    })
  ).catch(error => { clientPromise = null; throw error; });
  return clientPromise;
}

// Injectable SDK client keeps authentication and row-version behavior testable.
export function createAccountBackend(getClient = getSupabaseClient) {
  const check = result => { if (result.error) throw result.error; return result.data; };
  return {
    configured: true,
    async restoreSession() { const c = await getClient(); return check(await c.auth.getSession()).session; },
    async watchSession(listener) {
      const c = await getClient();
      const {data} = c.auth.onAuthStateChange((_event, session) => {
        // SDK auth callbacks must return before another SDK request is made.
        setTimeout(() => listener(session), 0);
      });
      return () => data.subscription.unsubscribe();
    },
    async signIn({email, password}) {
      const c = await getClient(); return check(await c.auth.signInWithPassword({email, password}));
    },
    async signUp({email, password, username}) {
      const c = await getClient();
      return check(await c.auth.signUp({email, password, options: {
        data: {display_name: username}, emailRedirectTo: supabaseConfig.redirectUrl
      }}));
    },
    async signOut() { const c = await getClient(); check(await c.auth.signOut({scope: 'local'})); },
    async readSave(userId) {
      const c = await getClient();
      return check(await c.from('daily_island_saves').select('snapshot,version,updated_at').eq('user_id', userId).maybeSingle());
    },
    async writeSave(userId, snapshot, expectedVersion) {
      const c = await getClient();
      const query = expectedVersion === null
        ? c.from('daily_island_saves').insert({user_id: userId, snapshot})
        : c.from('daily_island_saves').update({snapshot}).eq('user_id', userId).eq('version', expectedVersion);
      const result = await query.select('version,updated_at').maybeSingle();
      if (result.error?.code === '23505') return {conflict: true};
      const data = check(result);
      return data ? {conflict: false, ...data} : {conflict: true};
    }
  };
}
export const accountBackend = createAccountBackend();

export function accountErrorMessage(error) {
  const code = error?.code || '', message = error?.message || '';
  if (error?.name === 'QuotaExceededError' || error?.name === 'SecurityError') return '浏览器无法保存备份或同步标记，操作已暂停。请先导出本地存档。';
  if (code === 'invalid_credentials') return '邮箱或密码不正确，请重新输入。';
  if (code === 'email_not_confirmed') return '请先打开邮箱中的确认邮件，再回来登录。';
  if (code === 'user_already_exists') return '此邮箱可能已经注册，请尝试登录。';
  if (code === 'weak_password') return '密码强度不足，请换一个更长的密码。';
  if (code === 'email_address_not_authorized' || /email address not authorized/i.test(message)) return '验证邮件暂时无法发送到此邮箱，请联系站点维护者配置邮件服务。';
  if (code.includes('rate_limit') || error?.status === 429) return '操作较频繁，请稍后再试。';
  if (code === 'PGRST205' || code === '42P01') return '云端数据表尚未就绪，本地记录待传输。';
  if (code === '42501') return '云端权限尚未就绪，本地记录待传输。';
  return '暂时无法连接账户或云端服务，本地记录仍可继续使用。';
}
