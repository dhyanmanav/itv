require('dotenv').config();
const express = require('express'), helmet = require('helmet'), rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser'), bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');
const crypto = require('crypto'), path = require('path');
const DB = require('./store');
const { SETS, SECTIONS, sec } = require('./questions');

const E = process.env, PORT = E.PORT || 3000, PROD = E.NODE_ENV === 'production';
const SECRET = E.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const GATE = E.GATE_PASSWORD || 'round1', ADMIN_CODE = E.ADMIN_PASSCODE || 'dhyan';
const ROUND3_GATE = E.ROUND3_PASSWORD || 'round3';
const ADMIN_EMAIL = (E.ADMIN_EMAIL || 'admin@event.local').toLowerCase(), ADMIN_PW = E.ADMIN_PASSWORD || 'Admin@2Dec';
const DURATION = (+E.EXAM_MINUTES || 45) * 60000, GRACE = 15000, N = 25;
const REASONS = ['manual', 'timeout', 'tab-switch', 'window-blur', 'fullscreen-exit', 'page-leave', 'reload'];
const h = s => crypto.createHash('sha256').update(String(s)).digest();
const eq = (a, b) => crypto.timingSafeEqual(h(a), h(b));
const ck = ms => ({ httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: ms });
const sign = (p, t) => jwt.sign(p, SECRET, { expiresIn: t });
const ver = t => { try { return jwt.verify(t, SECRET); } catch { return null; } };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1);[a[i], a[j]] = [a[j], a[i]]; } return a; };
const lim = (max, win = 10) => rateLimit({ windowMs: win * 60000, max, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again later.' } });

const app = express();
const wrap = f => (q, r, n) => Promise.resolve(f(q, r, n)).catch(n);
for (const m of ['get', 'post']) { const o = app[m].bind(app); app[m] = (p, ...h) => o(p, ...h.map(f => (typeof f === 'function' && f.length < 4 ? wrap(f) : f))); }
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0, etag: false, setHeaders: res => res.set('Cache-Control', 'no-store') }));
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// ---------- Home-page password gate ----------
app.post('/api/gate', lim(200), (req, res) => {
  if (!eq(req.body.password || '', GATE)) return res.status(401).json({ error: 'Wrong password' });
  res.cookie('gate', sign({ g: 1 }, '12h'), ck(12 * 3600e3));
  if (!req.cookies.devid) res.cookie('devid', crypto.randomUUID(), ck(365 * 864e5));
  res.json({ ok: true });
});
app.use('/api', (req, res, next) => {
  if (!ver(req.cookies.gate)) return res.status(401).json({ error: 'gate' });
  if (!req.cookies.devid) res.cookie('devid', crypto.randomUUID(), ck(365 * 864e5));
  next();
});
const who = req => ver(req.cookies.auth);
const needUser = (req, res, next) => { const p = who(req); if (!p || p.r !== 'u') return res.status(401).json({ error: 'Please sign in' }); req.uid = p.uid; next(); };
const needAdmin = (req, res, next) => { const p = who(req); if (!p || p.r !== 'a') return res.status(401).json({ error: 'Admin sign-in required' }); next(); };

// ---------- Auth ----------
app.get('/api/me', async (req, res) => {
  const p = who(req); if (!p) return res.json({});
  if (p.r === 'a') return res.json({ admin: true });
  const u = await DB.userById(p.uid);
  res.json(u ? { user: { name: u.name, usn: u.usn } } : {});
});
app.post('/api/signup', lim(400), async (req, res) => {
  const name = String(req.body.name || '').trim(), usn = String(req.body.usn || '').trim().toUpperCase();
  const email = String(req.body.email || '').trim().toLowerCase(), pw = String(req.body.password || '');
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Enter your full name' });
  if (!/^[A-Z0-9]{3,20}$/.test(usn)) return res.status(400).json({ error: 'Enter a valid USN / roll number' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 120) return res.status(400).json({ error: 'Enter a valid email' });
  if (pw.length < 6 || pw.length > 100) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (email === ADMIN_EMAIL) return res.status(400).json({ error: 'This email is reserved' });
  try {
    const id = await DB.addUser({ name, usn, email, pw: await bcrypt.hash(pw, 10) });
    res.cookie('auth', sign({ uid: id, r: 'u' }, '8h'), ck(8 * 3600e3)); res.json({ ok: true });
  } catch (e) { if (e.code === '23505') return res.status(409).json({ error: 'Email or USN is already registered. Use Sign in.' }); throw e; }
});
app.post('/api/login', lim(400), async (req, res) => {
  const u = await DB.userByEmail(String(req.body.email || '').trim().toLowerCase());
  const ok = await bcrypt.compare(String(req.body.password || ''), u ? u.pw : '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali');
  if (!u || !ok) return res.status(401).json({ error: 'Invalid email or password' });
  res.cookie('auth', sign({ uid: u.id, r: 'u' }, '8h'), ck(8 * 3600e3)); res.json({ ok: true });
});
app.post('/api/admin/login', lim(10), (req, res) => {
  const { email = '', password = '', passcode = '' } = req.body;
  const ok = eq(String(email).toLowerCase(), ADMIN_EMAIL) && eq(password, ADMIN_PW) && eq(passcode, ADMIN_CODE);
  if (!ok) return res.status(401).json({ error: 'Invalid admin credentials or passcode' });
  res.cookie('auth', sign({ r: 'a' }, '8h'), ck(8 * 3600e3)); res.json({ ok: true });
});
app.post('/api/logout', (req, res) => { res.clearCookie('auth'); res.json({ ok: true }); });

// ---------- Exam ----------
const isOpen = DB.getOpen;
async function finalize(a, answers, reason) {
  const late = Date.now() > a.deadline + GRACE, clean = {};
  const src = late || !answers || typeof answers !== 'object' ? a.answers : { ...a.answers, ...answers };
  for (const [k, v] of Object.entries(src)) { const n = +k; if (Number.isInteger(n) && n >= 1 && n <= N && typeof v === 'string' && /^[ABCD]$/.test(v)) clean[n] = v; }
  let r = REASONS.includes(reason) ? reason : 'manual';
  if (r === 'manual' && Date.now() > a.deadline) r = 'timeout';
  return DB.finish(a.id, { status: 'submitted', submitted_at: Math.min(Date.now(), a.deadline + GRACE), answers: clean, reason: r });
}
app.get('/api/status', needUser, async (req, res) => {
  const a = await DB.attemptOf(req.uid);
  if (a && a.status === 'started') { await finalize(a, null, Date.now() > a.deadline ? 'timeout' : 'reload'); return res.json({ state: 'done' }); }
  if (a) return res.json({ state: 'done' });
  res.json({ state: (await isOpen()) ? 'ready' : 'closed', minutes: DURATION / 60000, questions: N });
});
app.post('/api/start', needUser, async (req, res) => {
  if (!(await isOpen())) return res.status(403).json({ error: 'The test has not been opened yet. Please wait for the organisers.' });
  const ex = await DB.attemptOf(req.uid);
  if (ex) { if (ex.status === 'started') await finalize(ex, null, 'reload'); return res.json({ done: true }); }
  const deviceId = req.cookies.devid;
  if (!deviceId) return res.status(400).json({ error: 'Browser security setup failed. Refresh and try again.' });
  const used = await DB.attemptByDevice(deviceId);
  if (used) {
    if (used.uid === req.uid) await finalize(used, null, 'reload');
    return res.status(403).json({ error: 'This browser has already been used for the test.' });
  }
  const [c1, c2] = await Promise.all([1, 2].map(x => DB.countSet(x)));
  const set = c1 === c2 ? crypto.randomInt(2) + 1 : c1 < c2 ? 1 : 2; // random, kept balanced
  const order = shuffle(SETS[set].map((_, i) => i + 1)), now = Date.now();
  try {
    await DB.addAttempt({ uid: req.uid, device_id: req.cookies.devid, ip: req.ip, ua: (req.get('user-agent') || '').slice(0, 200), exam_set: set, q_order: order, answers: {}, status: 'started', started_at: now, deadline: now + DURATION });
  } catch (e) { if (e.code === '23505') return res.status(403).json({ error: 'This browser or account has already been used for the test.' }); throw e; }
  res.json({ now, deadline: now + DURATION, questions: order.map(id => { const q = SETS[set][id - 1]; return { id, q: q.q, o: q.o, sec: SECTIONS[sec(id - 1)] }; }) });
});
app.post('/api/answer', needUser, async (req, res) => {
  const n = +req.body.qid, v = req.body.ans;
  if (!Number.isInteger(n) || n < 1 || n > N || !/^[ABCD]$/.test(v)) return res.status(400).end();
  await DB.saveAnswer(req.uid, n, v);
  res.json({ ok: true });
});
app.post('/api/submit', needUser, async (req, res) => {
  const a = await DB.attemptOf(req.uid);
  if (a && a.status === 'started') await finalize(a, req.body.answers, req.body.reason);
  res.json({ ok: true }); // never reveals score
});

// ---------- Round 3: gated AI interview ----------
app.post('/api/round3/gate', lim(100), (req, res) => {
  if (!eq(req.body.password || '', ROUND3_GATE)) return res.status(401).json({ error: 'Wrong Round 3 password' });
  res.cookie('round3_gate', sign({ r3: 1 }, '12h'), ck(12 * 3600e3));
  res.json({ ok: true });
});
app.get('/api/round3/status', needUser, async (req, res) => {
  if (!ver(req.cookies.round3_gate)) return res.status(401).json({ error: 'round3_gate' });
  const a = await DB.round3AttemptOf(req.uid);
  if (a) return res.json({ state: a.status === 'submitted' ? 'done' : 'started', attempt: a.status === 'submitted' ? { submitted_at: a.submitted_at } : null });
  res.json({ state: 'ready', questions: 8 });
});
app.post('/api/round3/start', needUser, async (req, res) => {
  if (!ver(req.cookies.round3_gate)) return res.status(401).json({ error: 'round3_gate' });
  const existing = await DB.round3AttemptOf(req.uid);
  if (existing) return res.json(existing.status === 'submitted' ? { done: true } : { started: true, deadline: existing.deadline });
  const now = Date.now();
  await DB.addRound3Attempt({
    uid: req.uid, status: 'started', started_at: now, deadline: now + (8 * 120000),
    answers: {}, ip: req.ip, ua: (req.get('user-agent') || '').slice(0, 200)
  });
  res.json({ started: true, deadline: now + (8 * 120000), question_seconds: 120 });
});
app.post('/api/round3/answer', needUser, async (req, res) => {
  if (!ver(req.cookies.round3_gate)) return res.status(401).json({ error: 'round3_gate' });
  const question = +req.body.question;
  if (!Number.isInteger(question) || question < 1 || question > 8) return res.status(400).json({ error: 'Invalid question' });
  await DB.updateRound3Answer(req.uid, question, req.body.answer, req.body.result || null);
  res.json({ ok: true });
});
app.post('/api/round3/tab', needUser, async (req, res) => {
  if (!ver(req.cookies.round3_gate)) return res.status(401).json({ error: 'round3_gate' });
  await DB.incrementRound3Tabs(req.uid);
  res.json({ ok: true });
});
app.post('/api/round3/submit', needUser, async (req, res) => {
  if (!ver(req.cookies.round3_gate)) return res.status(401).json({ error: 'round3_gate' });
  await DB.finishRound3(req.uid, {
    status: 'submitted', submitted_at: Date.now(),
    report: req.body.report || null,
    tab_switches: Number.isInteger(req.body.tabSwitches) ? req.body.tabSwitches : 0
  });
  res.json({ ok: true });
});

app.get('/round3.html', (req, res) => {
  res.set('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  res.sendFile(path.join(__dirname, 'Placement Arena · AI Interview Round.html'));
});

// ---------- Admin ----------
app.get('/api/admin/results', needAdmin, async (req, res) => {
  const stale = await DB.expired(Date.now() - GRACE);
  for (const a of stale) await finalize(a, null, 'timeout');
  const [us, at] = await Promise.all([DB.allUsers(), DB.allAttempts()]);
  const m = new Map(at.map(a => [a.uid, a]));
  const rows = us.map(u => {
    const a = m.get(u.id); let score = null;
    if (a && a.status === 'submitted') { score = 0; SETS[a.exam_set].forEach((q, i) => { if (a.answers[i + 1] === q.a) score++; }); }
    return { uid: u.id, name: u.name, usn: u.usn, email: u.email, set: a ? a.exam_set : null, status: a ? a.status : 'registered', score, answered: a ? Object.keys(a.answers).length : 0, reason: a ? a.reason || '' : '', secs: a && a.submitted_at ? Math.round((a.submitted_at - a.started_at) / 1000) : null, submittedAt: a ? a.submitted_at || null : null, ip: a ? a.ip : '' };
  });
  res.json({ rows, open: await isOpen(), total: N });
});
app.post('/api/admin/open', needAdmin, async (req, res) => {
  await DB.setOpen(!!req.body.open); res.json({ ok: true });
});
app.post('/api/admin/reset', needAdmin, async (req, res) => { await DB.delAttempt(String(req.body.uid)); res.json({ ok: true }); });

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Server error' }); });

app.listen(PORT, '0.0.0.0', () => console.log('Exam server running on http://localhost:' + PORT));
