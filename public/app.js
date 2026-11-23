const $ = s => document.querySelector(s), app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = html => { app.innerHTML = html; };
async function api(p, body) {
  const r = await fetch('/api/' + p, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  let d = {}; try { d = await r.json(); } catch { }
  if (r.status === 401 && d.error === 'gate') { gateView(); throw new Error('gate'); }
  if (!r.ok) throw new Error(d.error || 'Something went wrong');
  return d;
}
const busy = (b, f) => async () => { b.disabled = true; try { await f(); } finally { b.disabled = false; } };

/* ---------- Gate ---------- */
function gateView() {
  view(`<div class="card"><div class="logo">⚡</div><h1>Aptitude Round</h1><p class="mut">Technical Event · 2 December<br>Enter the access password to continue.</p>
  <form id="gate-form" autocomplete="off" novalidate><label for="gp" class="mut">Access password</label><input id="gp" name="access-password" type="text" placeholder="Access password" value="" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="text" aria-label="Access password"><button id="go" class="btn" type="submit">Enter</button></form><p id="err" class="err"></p></div>`);
  const go = async () => { try { await api('gate', { password: $('#gp').value }); boot(); } catch (e) { $('#err').textContent = e.message; } };
  $('#gate-form').onsubmit = e => { e.preventDefault(); go(); };
  $('#gp').removeAttribute('readonly');
  $('#gp').removeAttribute('disabled');
  $('#gp').oninput = e => { $('#err').textContent = ''; e.target.value = e.target.value; };
  $('#gp').focus();
  setTimeout(() => $('#gp')?.focus(), 50);
}

/* ---------- Sign up / Sign in ---------- */
function authView(mode = 'signup') {
  const su = mode === 'signup';
  view(`<div class="card"><div class="logo">🎯</div><h1>${su ? 'Create your account' : 'Welcome back'}</h1>
  <p class="mut">${su ? 'Sign up once to unlock the test. You get a single attempt.' : 'Sign in to continue to the test.'}</p>
  <form id="auth-form" autocomplete="on" novalidate>
  ${su ? '<label class="mut" for="n">Full name</label><input id="n" name="name" type="text" placeholder="Full name" autocomplete="name" required><label class="mut" for="u">USN / Roll number</label><input id="u" name="usn" type="text" placeholder="USN / Roll number" autocomplete="off" autocapitalize="characters" required>' : ''}
  <label class="mut" for="e">Email</label><input id="e" name="email" type="email" placeholder="Email" autocomplete="email" required>
  <label class="mut" for="p">Password</label><input id="p" name="password" type="password" placeholder="${su ? 'Password (min 6 chars)' : 'Password'}" autocomplete="${su ? 'new-password' : 'current-password'}" required>
  <button id="go" class="btn" type="submit">${su ? 'Sign up & continue' : 'Sign in'}</button></form><p id="err" class="err"></p>
  <div class="foot"><span>${su ? 'Already registered?' : 'New here?'} <button id="sw" class="link">${su ? 'Sign in' : 'Sign up'}</button></span><button id="ad" class="adm">Admin</button></div></div>`);
  $('#sw').onclick = () => authView(su ? 'login' : 'signup'); $('#ad').onclick = adminLoginView;
  const go = busy($('#go'), async () => {
    try { await api(su ? 'signup' : 'login', { name: su && $('#n').value, usn: su && $('#u').value, email: $('#e').value, password: $('#p').value }); boot(); }
    catch (e) { $('#err').textContent = e.message; }
  });
  $('#auth-form').onsubmit = e => { e.preventDefault(); go(); };
  (su ? $('#n') : $('#e')).focus();
}
function adminLoginView() {
  view(`<div class="card"><div class="logo">🛡️</div><h1>Admin sign in</h1><p class="mut">Organisers only. Passcode required.</p>
  <form id="admin-form" autocomplete="off" novalidate>
  <label class="mut" for="e">Admin email</label><input id="e" name="email" type="email" placeholder="Admin email" autocomplete="username" required>
  <label class="mut" for="p">Admin password</label><input id="p" name="password" type="password" placeholder="Admin password" autocomplete="current-password" required>
  <label class="mut" for="c">Admin passcode</label><input id="c" name="passcode" type="password" placeholder="Admin passcode" autocomplete="off" required>
  <button id="go" class="btn" type="submit">Open dashboard</button></form><p id="err" class="err"></p><div class="foot"><button id="bk" class="link">← Back</button><span></span></div></div>`);
  $('#bk').onclick = () => authView();
  const go = busy($('#go'), async () => { try { await api('admin/login', { email: $('#e').value, password: $('#p').value, passcode: $('#c').value }); boot(); } catch (e) { $('#err').textContent = e.message; } });
  $('#admin-form').onsubmit = e => { e.preventDefault(); go(); };
  $('#e').focus();
}

/* ---------- Participant home ---------- */
async function userHome(user) {
  const s = await api('status');
  if (s.state === 'done') return doneView();
  view(`<div class="card wide"><div class="logo">📝</div><h1>Hi ${esc(user.name.split(' ')[0])}, ready?</h1><p class="mut">${esc(user.usn)} · Aptitude Round</p>
  <ul class="rules"><li><b>${s.questions} questions</b>, <b>${s.minutes} minutes</b>, 1 mark each, no negative marking.</li>
  <li>You get <b>one attempt only</b> — on this account and this browser.</li>
  <li>The test opens in <b>full-screen</b>. Do <b>not</b> switch tabs, minimise, click outside, or exit full-screen.</li>
  <li>Doing so <b>submits your test instantly</b>. Reloading the page also ends it.</li>
  <li>Your result is <b>not shown</b> here — the organisers will announce it.</li></ul>
  <div class="warn">⚠️ Close all other tabs, apps and notifications before you start.</div>
  ${s.state === 'closed' ? '<p class="err">The test has not been opened yet. Wait for the organisers, then tap Refresh.</p><button id="rf" class="btn">Refresh</button>' : '<button id="st" class="btn">I understand — Start test</button><p id="err" class="err"></p>'}
  <div class="foot"><span></span><button id="lo" class="link">Sign out</button></div></div>`);
  $('#lo').onclick = async () => { await api('logout', {}); boot(); };
  if ($('#rf')) $('#rf').onclick = () => userHome(user);
  if ($('#st')) $('#st').onclick = async () => {
    try { await document.documentElement.requestFullscreen(); } catch { }
    try { const d = await api('start', {}); if (d.done) return doneView(); runExam(d); }
    catch (e) { if (document.fullscreenElement) document.exitFullscreen().catch(() => { }); $('#err').textContent = e.message; }
  };
}
function doneView() {
  localStorage.setItem('xd', '1');
  view(`<div class="card"><div class="tick">✅</div><h1 style="text-align:center">Test submitted</h1><p class="mut" style="text-align:center">Your responses have been recorded.<br>Results will be announced by the organisers. You may close this window.</p>
  <a class="btn" href="https://www.hackerrank.com/test-2026-1" target="_blank" rel="noopener noreferrer" style="display:block;text-align:center;text-decoration:none">Continue to Round 2</a>
  <a class="btn ghost" href="/round3.html" style="display:block;text-align:center;text-decoration:none;margin-top:10px">Continue to Round 3</a>
  <button id="lo" class="btn ghost">Sign out</button></div>`);
  $('#lo').onclick = async () => { await api('logout', {}); boot(); };
}

/* ---------- Exam + safe-browser guard ---------- */
function runExam(d) {
  const qs = d.questions, off = d.now - Date.now(), ans = {}, offs = []; let i = 0, over = false, armed = false, tm;
  const left = () => Math.max(0, d.deadline - (Date.now() + off));
  const fmt = ms => { const s = Math.ceil(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const count = () => Object.keys(ans).length;
  function draw() {
    const q = qs[i];
    view(`<div class="exam"><div class="top"><div><b>Question ${i + 1}</b> / ${qs.length}<div class="mut" style="margin:0;font-size:.8rem"><span id="ct">${count()}</span> answered</div></div><div id="tm" class="timer">${fmt(left())}</div></div>
    <div class="bar"><i style="width:${(count() / qs.length) * 100}%"></i></div>
    <div class="q"><div class="tag">${esc(q.sec)}</div><div class="qt">${esc(q.q)}</div>
    ${q.o.map((o, k) => { const L = 'ABCD'[k]; return `<button class="opt ${ans[q.id] === L ? 'sel' : ''}" data-l="${L}"><b>${L}</b><span>${esc(o)}</span></button>`; }).join('')}</div>
    <div class="nav"><button id="pv" class="btn ghost" ${i ? '' : 'disabled'}>← Previous</button>${i < qs.length - 1 ? '<button id="nx" class="btn">Next →</button>' : '<button id="sb" class="btn">Submit test</button>'}</div>
    <div class="pal">${qs.map((x, k) => `<button data-k="${k}" class="${ans[x.id] ? 'done' : ''} ${k === i ? 'cur' : ''}">${k + 1}</button>`).join('')}</div>
    <div class="nav"><button id="sb2" class="btn ghost">Finish &amp; submit</button></div></div>`);
    document.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      ans[q.id] = b.dataset.l; fetch('/api/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qid: q.id, ans: b.dataset.l }) }).catch(() => { }); draw();
    });
    document.querySelectorAll('.pal button').forEach(b => b.onclick = () => { i = +b.dataset.k; draw(); });
    if ($('#pv')) $('#pv').onclick = () => { i--; draw(); }; if ($('#nx')) $('#nx').onclick = () => { i++; draw(); };
    ($('#sb') || { set onclick(f) { } }).onclick = confirmSubmit; $('#sb2').onclick = confirmSubmit;
  }
  function confirmSubmit() {
    const o = document.createElement('div'); o.className = 'ov';
    o.innerHTML = `<div class="card"><h2>Submit test?</h2><p class="mut">You answered ${count()} of ${qs.length}. You cannot change answers after submitting.</p><button id="y" class="btn">Yes, submit</button><button id="n" class="btn ghost">Go back</button></div>`;
    document.body.appendChild(o); $('#y').onclick = () => { o.remove(); finish('manual'); }; $('#n').onclick = () => o.remove();
  }
  function finish(reason) {
    if (over) return; over = true; clearInterval(tm); offs.forEach(f => f());
    if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
    const send = (n) => fetch('/api/submit', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: ans, reason }) }).catch(() => n > 0 && setTimeout(() => send(n - 1), 1500));
    send(4); doneView();
  }
  const vio = r => armed && finish(r);
  const on = (t, e, f) => { t.addEventListener(e, f); offs.push(() => t.removeEventListener(e, f)); };
  on(document, 'visibilitychange', () => document.hidden && vio('tab-switch'));
  on(window, 'blur', () => vio('window-blur'));
  on(window, 'beforeunload', e => { if (!over) { e.preventDefault(); e.returnValue = ''; vio('page-leave'); } });
  on(document, 'fullscreenchange', () => !document.fullscreenElement && vio('fullscreen-exit'));
  on(window, 'pagehide', () => vio('page-leave'));
  ['contextmenu', 'copy', 'cut', 'paste', 'dragstart', 'selectstart'].forEach(ev => on(document, ev, e => e.preventDefault()));
  on(document, 'keydown', e => { const k = e.key.toLowerCase(); if (e.key === 'F12' || e.key === 'F5' || ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'u', 's', 'p', 'a', 'r'].includes(k)) || (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(k))) e.preventDefault(); });
  tm = setInterval(() => { const l = left(), t = $('#tm'); if (t) { t.textContent = fmt(l); t.classList.toggle('low', l < 120000); } if (l <= 0) finish('timeout'); }, 500);
  draw(); setTimeout(() => { armed = true; }, 1500);
}

/* ---------- Admin dashboard ---------- */
const A = { rows: [], q: '', st: '', set: '', sort: 'score', dir: -1, open: true, timer: null };
const R3 = { rows: [] };
const REASON = { 'tab-switch': 'Switched tab', 'window-blur': 'Left window', 'fullscreen-exit': 'Exited fullscreen', 'page-leave': 'Left page', reload: 'Reloaded', timeout: 'Time up', manual: '' };
async function adminView() {
  const d = await api('admin/results'); A.rows = d.rows; A.open = d.open; A.total = d.total;
  const r3 = await api('admin/round3-results'); R3.rows = r3.rows;
  if (!$('#tb')) {
    view(`<div class="card xl"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div><h1>Results dashboard</h1><p class="mut" style="margin:0">Live · scores calculated automatically from the answer key</p></div>
    <div class="tools" style="margin:0"><button id="op" class="btn sm"></button><button id="ex" class="btn sm ghost">⬇ CSV</button><button id="rf" class="btn sm ghost">Refresh</button><button id="lo" class="btn sm ghost">Sign out</button></div></div>
    <div class="tools"><button id="tab1" class="btn sm">Round 1 Results</button><button id="tab3" class="btn sm ghost">Round 3 Results</button></div>
    <div id="round1-panel">
    <div class="stats" id="stats"></div>
    <div class="tools"><input id="s" placeholder="Search name / USN / email"><select id="fs"><option value="">All status</option><option value="submitted">Submitted</option><option value="started">In progress</option><option value="registered">Not started</option></select><select id="fz"><option value="">Both sets</option><option value="1">Set 1</option><option value="2">Set 2</option></select></div>
    <div class="tw"><table><thead><tr>${[['#', ''], ['Name', 'name'], ['USN', 'usn'], ['Email', 'email'], ['Set', 'set'], ['Status', 'status'], ['Score', 'score'], ['Answered', 'answered'], ['Time', 'secs'], ['Ended by', 'reason'], ['IP', 'ip'], ['', '']].map(([t, k]) => `<th data-k="${k}">${t}</th>`).join('')}</tr></thead><tbody id="tb"></tbody></table></div></div>
    <div id="round3-panel" style="display:none"></div></div>`);
    $('#s').oninput = e => { A.q = e.target.value.toLowerCase(); paint(); }; $('#fs').onchange = e => { A.st = e.target.value; paint(); }; $('#fz').onchange = e => { A.set = e.target.value; paint(); };
    document.querySelectorAll('th[data-k]').forEach(th => th.onclick = () => { const k = th.dataset.k; if (!k) return; A.dir = A.sort === k ? -A.dir : -1; A.sort = k; paint(); });
    $('#rf').onclick = adminView; $('#ex').onclick = csv; $('#lo').onclick = async () => { clearInterval(A.timer); await api('logout', {}); boot(); };
    $('#op').onclick = async () => { await api('admin/open', { open: !A.open }); adminView(); };
    $('#tab1').onclick = () => { $('#round1-panel').style.display = ''; $('#round3-panel').style.display = 'none'; $('#tab1').className = 'btn sm'; $('#tab3').className = 'btn sm ghost'; };
    $('#tab3').onclick = () => { $('#round1-panel').style.display = 'none'; $('#round3-panel').style.display = ''; $('#tab1').className = 'btn sm ghost'; $('#tab3').className = 'btn sm'; paintRound3(); };
    A.timer = setInterval(() => $('#tb') ? adminView().catch(() => { }) : clearInterval(A.timer), 15000);
  }
  paint();
}
const view2 = () => A.rows.filter(r => (!A.q || (r.name + r.usn + r.email).toLowerCase().includes(A.q)) && (!A.st || r.status === A.st) && (!A.set || String(r.set) === A.set))
  .sort((a, b) => { const x = a[A.sort] ?? -1, y = b[A.sort] ?? -1; return (x > y ? 1 : x < y ? -1 : 0) * A.dir; });
function paint() {
  const all = A.rows, sub = all.filter(r => r.status === 'submitted'), sc = sub.map(r => r.score);
  const stat = [[all.length, 'Registered'], [all.filter(r => r.status === 'started').length, 'In progress'], [sub.length, 'Submitted'], [sc.length ? (sc.reduce((a, b) => a + b, 0) / sc.length).toFixed(1) : '–', 'Average / ' + A.total], [sc.length ? Math.max(...sc) : '–', 'Highest'], [sub.filter(r => r.set === 1).length + ' / ' + sub.filter(r => r.set === 2).length, 'Set 1 / Set 2'], [sub.filter(r => r.reason && r.reason !== 'manual' && r.reason !== 'timeout').length, 'Auto-submitted (violation)']];
  $('#stats').innerHTML = stat.map(([v, l]) => `<div class="st"><b>${v}</b><span>${l}</span></div>`).join('');
  $('#op').textContent = A.open ? '🟢 Test OPEN — click to close' : '🔴 Test CLOSED — click to open';
  $('#tb').innerHTML = view2().map((r, n) => `<tr><td>${n + 1}</td><td>${esc(r.name)}</td><td>${esc(r.usn)}</td><td>${esc(r.email)}</td><td>${r.set ?? '–'}</td><td><span class="pill p-${r.status}">${r.status === 'registered' ? 'not started' : r.status === 'started' ? 'in progress' : r.status}</span></td>
  <td class="sc">${r.score === null ? '–' : r.score + ' / ' + A.total}</td><td>${r.answered}</td><td>${r.secs === null ? '–' : Math.floor(r.secs / 60) + 'm ' + r.secs % 60 + 's'}</td><td class="${r.reason && r.reason !== 'manual' ? 'bad' : ''}">${esc(REASON[r.reason] ?? r.reason)}</td><td>${esc(r.ip)}</td>
  <td>${r.status !== 'registered' ? `<button class="btn sm ghost" data-r="${esc(r.uid)}">Reset</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="12" class="mut">No participants yet</td></tr>';
  document.querySelectorAll('[data-r]').forEach(b => b.onclick = async () => { if (!confirm('Reset this participant\'s attempt so they can retake? (use only for technical failures)')) return; await api('admin/reset', { uid: b.dataset.r }); adminView(); });
}
function csv() {
  const cell = v => { v = String(v ?? ''); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
  const rows = [['Rank', 'Name', 'USN', 'Email', 'Set', 'Status', 'Score', 'Out of', 'Answered', 'Seconds', 'Ended by', 'IP']];
  view2().forEach((r, n) => rows.push([n + 1, r.name, r.usn, r.email, r.set, r.status, r.score, A.total, r.answered, r.secs, r.reason, r.ip]));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(cell).join(',')).join('\n')], { type: 'text/csv' })); a.download = 'aptitude-results.csv'; a.click();
}

function paintRound3() {
  const rows = R3.rows;
  const submitted = rows.filter(r => r.status === 'submitted').length;
  $('#round3-panel').innerHTML = `<div class="stats">
    <div class="st"><b>${rows.length}</b><span>Registered</span></div>
    <div class="st"><b>${submitted}</b><span>Submitted</span></div>
    <div class="st"><b>${rows.filter(r => r.status === 'started').length}</b><span>In progress</span></div>
  </div><div class="tools"><button id="r3csv" class="btn sm ghost">⬇ Round 3 CSV</button></div>
  <div class="tw"><table><thead><tr><th>#</th><th>Name</th><th>USN</th><th>Status</th><th>Score / 80</th><th>Percent</th><th>Band</th><th>Tab switches</th><th>Submitted</th><th>Answered</th><th>IP</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.name)}</td><td>${esc(r.usn)}</td><td><span class="pill p-${r.status === 'submitted' ? 'submitted' : r.status === 'started' ? 'started' : 'registered'}">${esc(r.status)}</span></td><td class="sc">${r.score === null ? '–' : r.score + ' / 80'}</td><td>${r.percent === null ? '–' : r.percent + '%'}</td><td>${esc(r.band || '–')}</td><td>${r.tabSwitches}</td><td>${r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '–'}</td><td>${Object.keys(r.answers).length}/8</td><td>${esc(r.ip)}</td></tr>`).join('') || '<tr><td colspan="11">No Round 3 submissions</td></tr>'}</tbody></table></div>`;
  $('#r3csv').onclick = round3Csv;
}

function round3Csv() {
  const cell = v => { v = String(v ?? ''); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
  const rows = [['Name','USN','Status','Score','Out of','Percent','Band','Tab switches','Submitted','Answered','IP']];
  R3.rows.forEach(r => rows.push([r.name,r.usn,r.status,r.score ?? '',80,r.percent ?? '',r.band ?? '',r.tabSwitches,r.submittedAt ? new Date(r.submittedAt).toISOString() : '',Object.keys(r.answers).length,r.ip]));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(cell).join(',')).join('\n')], { type:'text/csv' })); a.download = 'round3-results.csv'; a.click();
}

/* ---------- Boot ---------- */
async function boot() {
  app.onkeydown = null;
  try { const me = await api('me'); if (me.admin) return adminView(); if (me.user) return userHome(me.user); authView('signup'); }
  catch (e) { if (e.message !== 'gate') view(`<div class="card"><h1>Connection problem</h1><p class="mut">${esc(e.message)}</p><button class="btn" onclick="boot()">Retry</button></div>`); }
}
boot();
