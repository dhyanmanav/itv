// Supabase data layer (server-side only, uses the service_role key)
const { createClient } = require('@supabase/supabase-js');
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env (use the service_role key, never a publishable or anon key).');
  process.exit(1);
}
if (!/^https:\/\/.+\.supabase\.co\/?$/.test(url)) {
  console.error('SUPABASE_URL must be the Supabase project URL ending in .supabase.co');
  process.exit(1);
}
if (/^sb_(publishable|secret)_/.test(key)) {
  console.error('SUPABASE_SERVICE_KEY is not a service_role key. Copy the legacy JWT service_role key from Supabase Project Settings -> API.');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const run = async q => { const { data, error } = await q; if (error) throw error; return data; };
const one = q => run(q.maybeSingle());
module.exports = {
  userById: id => one(sb.from('users').select('id,name,usn').eq('id', id)),
  userByEmail: e => one(sb.from('users').select('*').eq('email', e)),
  addUser: async u => (await run(sb.from('users').insert(u).select('id').single())).id,
  attemptOf: uid => one(sb.from('attempts').select('*').eq('uid', uid)),
  attemptByDevice: device => one(sb.from('attempts').select('*').eq('device_id', device)),
  addAttempt: a => run(sb.from('attempts').insert(a)),
  countSet: async s => { const { count, error } = await sb.from('attempts').select('id', { count: 'exact', head: true }).eq('exam_set', s); if (error) throw error; return count; },
  saveAnswer: (uid, q, a) => run(sb.rpc('save_answer', { p_uid: uid, p_qid: q, p_ans: a, p_now: Date.now() })),
  finish: (id, patch) => run(sb.from('attempts').update(patch).eq('id', id).eq('status', 'started')),
  expired: now => run(sb.from('attempts').select('*').eq('status', 'started').lt('deadline', now)),
  allUsers: () => run(sb.from('users').select('id,name,usn,email')),
  allAttempts: () => run(sb.from('attempts').select('*')),
  delAttempt: uid => run(sb.from('attempts').delete().eq('uid', uid)),
  getOpen: async () => { const r = await one(sb.from('settings').select('v').eq('key', 'open')); return r ? r.v : true; },
  setOpen: v => run(sb.from('settings').upsert({ key: 'open', v })),
};
