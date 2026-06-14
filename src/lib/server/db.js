import { createRequire } from 'module';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { createHash, randomBytes } from 'crypto';
import { seedCurriculum } from './seed.js';
import { seedQuizQuestions } from './quiz-seed.js';
import { seedFFVLQuestions } from './ffvl-seed.js';

// Load better-sqlite3 safely — static import would kill the whole module on failure
const _require = createRequire(import.meta.url);
let Database = null;
try {
  Database = _require('better-sqlite3');
  console.log('[db] better-sqlite3 loaded OK');
} catch(e) {
  console.error('[db] better-sqlite3 FAILED to load:', e.message);
}

const DATA_DIR = process.env.DATA_DIR || '/data';
try { mkdirSync(DATA_DIR, { recursive: true }); } catch(e) {}
const DB_PATH = join(DATA_DIR, 'summit.db');

let _db;
function safeAlter(db) {
  // ── Create session_roster if missing (runs outside any failing transaction) ──
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS session_roster (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      session_date   TEXT NOT NULL,
      student_id     INTEGER NOT NULL,
      status         TEXT DEFAULT 'ground',
      launched_at    DATETIME,
      landed_at      DATETIME,
      last_heartbeat DATETIME,
      source         TEXT DEFAULT 'manual',
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('[db] session_roster ready');
  } catch(e) { console.error('[db] session_roster create:', e.message); }

  // ── Add missing columns to session_roster ──
  for (const col of ['last_heartbeat DATETIME', 'source TEXT', 'launched_at DATETIME', 'landed_at DATETIME']) {
    try { db.prepare('ALTER TABLE session_roster ADD COLUMN ' + col).run(); } catch(e) {}
  }

  // ── Add missing columns to student_equipment ──
  for (const col of [
    'wing_le_color  TEXT',
    'wing_color_2   TEXT',
    'glider_make    TEXT',
    'glider_model   TEXT',
    'harness_make   TEXT',
    'reserve_serial TEXT',
  ]) {
    try { db.prepare('ALTER TABLE student_equipment ADD COLUMN ' + col).run(); } catch(e) {}
  }

  // ── student_bills: add missing columns on older deployed DBs ──
  // Without these, createBill INSERT throws "no such column" → bill upload silently fails
  try { db.exec("ALTER TABLE student_bills ADD COLUMN uploader_type TEXT DEFAULT 'instructor'"); } catch(e) {}
  try { db.exec("ALTER TABLE student_bills ADD COLUMN notes TEXT"); } catch(e) {}

  // ── Medical/important notes on student profile ──
  try { db.exec('ALTER TABLE students ADD COLUMN medical_notes TEXT'); } catch(e) {}
  // ── Manual flight source column ──
  try { db.exec("ALTER TABLE flights ADD COLUMN source TEXT DEFAULT 'app'"); } catch(e) {}

  // ── Debriefing acknowledgement columns ──
  for (const col of ['student_acknowledged INTEGER DEFAULT 0', 'acknowledged_at DATETIME']) {
    try { db.prepare('ALTER TABLE flight_debriefings ADD COLUMN ' + col).run(); } catch(e) {}
  }
  // Ensure all debriefing columns exist
  try { db.prepare('ALTER TABLE flight_debriefings ADD COLUMN viewed_at DATETIME').run(); } catch(e) {}
  try { db.prepare('ALTER TABLE flight_debriefings ADD COLUMN student_comment TEXT').run(); } catch(e) {}

  // ── Guarantee ALL flight columns exist — prevents UPDATE failures ──
  const fcols_safe = (() => { try { return db.pragma('table_info(flights)').map(c=>c.name); } catch(e) { return []; } })();
  const addFlight = (col) => { try { if (!fcols_safe.includes(col.split(' ')[0])) db.exec('ALTER TABLE flights ADD COLUMN ' + col); } catch(e) {} };
  addFlight('landing_site TEXT');
  addFlight('start_time TEXT');
  addFlight('end_time TEXT');
  addFlight('launch_type TEXT');
  addFlight('confidence_rating INTEGER');
  addFlight('thermals_caught INTEGER');
  addFlight('meters_gained INTEGER');
  addFlight('exercises_done TEXT');
  addFlight('what_went_well TEXT');
  addFlight('what_to_improve TEXT');
  addFlight('next_goals TEXT');
  addFlight('personal_notes TEXT');
  addFlight('launch_quality INTEGER');
  addFlight('landing_quality INTEGER');
  addFlight('flight_type TEXT');
  addFlight('duration_seconds INTEGER');
  addFlight('distance_km REAL');
  addFlight('max_altitude_m REAL');
  addFlight('takeoff_lat REAL');
  addFlight('takeoff_lon REAL');
  addFlight('landing_lat REAL');
  addFlight('landing_lon REAL');
  addFlight('track_geojson TEXT');

  // ── Ensure notifications table always exists (V42 may not have run) ──
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS notifications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      type       TEXT,
      title      TEXT,
      message    TEXT,
      action_url TEXT,
      read       INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch(e) {}

  // ── Registration requests table ──
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS registration_requests (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      phone       TEXT,
      email       TEXT,
      message     TEXT,
      status      TEXT DEFAULT 'pending',
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch(e) {}

  // ── Deduplicate roster and add unique index ──
  try {
    db.exec(`DELETE FROM session_roster WHERE id NOT IN (
      SELECT MAX(id) FROM session_roster GROUP BY student_id, session_date
    )`);
  } catch(e) {}
  try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_roster_uq ON session_roster(student_id, session_date)');
  } catch(e) {}
}

export function getDb() {
  if (!_db) {
    if (!Database) throw new Error('[db] SQLite native module (better-sqlite3) is not available. Check server logs.');
    // Ensure data directory exists before opening DB
    try { mkdirSync(DATA_DIR, { recursive: true }); } catch(e) {}
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    try { initSchema(_db); } catch(e) { console.error('[db] initSchema:', e.message); }
    try { runMigrations(_db); }       catch(e) { console.error('[db] runMigrations:', e.message); }
    try { runV42Migrations(_db); }    catch(e) { console.error('[db] runV42Migrations:', e.message); }
    try { runV47Migrations(_db); }    catch(e) { console.error('[db] runV47Migrations:', e.message); }
    // Always create debriefing tables — run independently so a V47 error doesn't block it
    try { runDebriefingMigration(_db); } catch(e) { console.error('[db] runDebriefingMigration:', e.message); }
    try { runV48Migrations(_db); }     catch(e) { console.error('[db] runV48Migrations:', e.message); }
    // Safe schema migrations — run unconditionally, independent of above failures
    try { safeAlter(_db); } catch(e) { console.error('[db] safeAlter:', e.message); }
    try { seedFFVLQuestions(_db); }     catch(e) { console.error('[db] seedFFVLQuestions:', e.message); }
    try { seedDefaults(_db); }        catch(e) { console.error('[db] seedDefaults:', e.message); }
    try { seedCurriculum(_db); }      catch(e) { console.error('[db] seedCurriculum:', e.message); }
    try { seedQuizQuestions(_db); }   catch(e) { console.error('[db] seedQuizQuestions:', e.message); }
    try {
      const removed = deduplicateExercises(_db);
      if (removed) console.log(`[db] Removed ${removed} duplicate exercise definitions`);
    } catch(e) { console.error('[db] dedup:', e.message); }
    // Always enforce correct exercise counts:
    // ground_handling = #1-#18 only (10 pre-flight + 8 launch = 18)
    // airborne = #19-#42 + P2 (39 total: 19 if + 5 lnd + 15 p2)
    try {
      // Remove pre-solo by title pattern
      const r1 = _db.prepare(
        "DELETE FROM exercises WHERE category='ground_handling' AND (title LIKE 'Pre-Solo%' OR title LIKE 'PS-%' OR title LIKE 'Pré-solo%' OR title LIKE 'pre-solo%')"
      ).run();
      // Remove any ground_handling exercise beyond order_idx 18 (safety net)
      const r2 = _db.prepare(
        "DELETE FROM exercises WHERE category='ground_handling' AND order_idx > 18"
      ).run();
      const total = (r1.changes||0) + (r2.changes||0);
      if (total) console.log(`[db] Removed ${total} non-curriculum ground exercises`);
    } catch(e) { console.error('[db] exercise cleanup:', e.message); }
  }
  return _db;
}

// ─────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────
function initSchema(db) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS instructors (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS students (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    email           TEXT,
    phone           TEXT,
    pin_hash        TEXT NOT NULL,
    enrollment_date DATE DEFAULT (date('now')),
    notes           TEXT,
    active          INTEGER DEFAULT 1,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );


  CREATE TABLE IF NOT EXISTS student_equipment (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    glider_make TEXT,
    glider_model TEXT,
    glider_size TEXT,
    harness     TEXT,
    reserve     TEXT,
    notes       TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS theory_blocks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    title_fr    TEXT,
    description TEXT,
    description_fr TEXT,
    content     TEXT,
    content_fr  TEXT,
    phase       TEXT DEFAULT 'p1',
    order_idx   INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS exercises (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    title            TEXT NOT NULL,
    title_fr         TEXT,
    description      TEXT,
    description_fr   TEXT,
    category         TEXT DEFAULT 'ground_handling',
    order_idx        INTEGER DEFAULT 0,
    requires_signoff INTEGER DEFAULT 1,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS exam_defs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    title_fr    TEXT,
    description TEXT,
    description_fr TEXT,
    type        TEXT DEFAULT 'theory',
    phase       TEXT DEFAULT 'p1',
    order_idx   INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS theory_progress (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    block_id     INTEGER NOT NULL REFERENCES theory_blocks(id) ON DELETE CASCADE,
    completed    INTEGER DEFAULT 0,
    completed_at DATETIME,
    UNIQUE(student_id, block_id)
  );

  CREATE TABLE IF NOT EXISTS exercise_logs (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id       INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    exercise_id      INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    date             DATE DEFAULT (date('now')),
    attempt_notes    TEXT,
    status           TEXT DEFAULT 'pending',
    instructor_notes TEXT,
    signed_off_by    INTEGER REFERENCES instructors(id),
    signed_off_at    DATETIME,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS exam_attempts (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id       INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    exam_id          INTEGER NOT NULL REFERENCES exam_defs(id) ON DELETE CASCADE,
    date             DATE DEFAULT (date('now')),
    score            REAL,
    max_score        REAL DEFAULT 100,
    passed           INTEGER,
    student_notes    TEXT,
    instructor_notes TEXT,
    signed_off_by    INTEGER REFERENCES instructors(id),
    signed_off_at    DATETIME,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS flights (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id        INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date              DATE DEFAULT (date('now')),
    status            TEXT DEFAULT 'preflight',
    -- pre-flight
    site              TEXT,
    wind_speed        TEXT,
    wind_direction    TEXT,
    glider            TEXT,
    conditions_notes  TEXT,
    mental_condition  INTEGER,
    -- post-flight
    launch_quality    INTEGER,
    landing_quality   INTEGER,
    flight_type       TEXT,
    thermals_caught   INTEGER,
    meters_gained     INTEGER,
    exercises_done    TEXT,
    what_went_well    TEXT,
    what_to_improve   TEXT,
    next_goals        TEXT,
    personal_notes    TEXT,
    -- gps
    duration_seconds  INTEGER,
    distance_km       REAL,
    max_altitude_m    INTEGER,
    takeoff_lat       REAL,
    takeoff_lon       REAL,
    landing_lat       REAL,
    landing_lon       REAL,
    track_geojson     TEXT,
    -- meta
    share_token       TEXT UNIQUE,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS student_sessions (
    token       TEXT PRIMARY KEY,
    student_id  INTEGER REFERENCES students(id) ON DELETE CASCADE,
    expires_at  DATETIME
  );

  CREATE TABLE IF NOT EXISTS instructor_sessions (
    token          TEXT PRIMARY KEY,
    instructor_id  INTEGER REFERENCES instructors(id) ON DELETE CASCADE,
    expires_at     DATETIME
  );

  CREATE INDEX IF NOT EXISTS idx_fl_student  ON flights(student_id);
  CREATE INDEX IF NOT EXISTS idx_el_student  ON exercise_logs(student_id);
  CREATE INDEX IF NOT EXISTS idx_ea_student  ON exam_attempts(student_id);
  CREATE INDEX IF NOT EXISTS idx_tp_student  ON theory_progress(student_id);
  `);
}


function runMigrations(db) {
  // Add equipment table if missing
  db.exec(`CREATE TABLE IF NOT EXISTS student_equipment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    glider_make TEXT, glider_model TEXT, glider_size TEXT,
    glider_flat_area REAL,
    glider_weight REAL,
    harness TEXT, harness_weight REAL,
    reserve TEXT, reserve_weight REAL,
    pilot_weight REAL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)
  // Add new columns if missing (existing installs)
  const eqCols = db.pragma('table_info(student_equipment)').map(c=>c.name);
  const newEqCols = { glider_flat_area:'REAL', glider_projected_area:'REAL', glider_weight:'REAL', harness_weight:'REAL', reserve_weight:'REAL', pilot_weight:'REAL', loading_min:'REAL', loading_max:'REAL', wing_color_1:'TEXT', wing_color_2:'TEXT', harness_color:'TEXT' };
  for (const [col, type] of Object.entries(newEqCols)) {
    if (!eqCols.includes(col)) db.exec(`ALTER TABLE student_equipment ADD COLUMN ${col} ${type}`);
  };
  // Add landing_site and time fields to flights if missing
  const fcols = db.pragma('table_info(flights)').map(c=>c.name);
  if (!fcols.includes('landing_site'))  db.exec('ALTER TABLE flights ADD COLUMN landing_site TEXT');
  if (!fcols.includes('start_time'))    db.exec('ALTER TABLE flights ADD COLUMN start_time TEXT');
  if (!fcols.includes('end_time'))      db.exec('ALTER TABLE flights ADD COLUMN end_time TEXT');
  if (!fcols.includes('launch_type'))   db.exec('ALTER TABLE flights ADD COLUMN launch_type TEXT');
  // Add score to exam_attempts
  const ecols = db.pragma('table_info(exam_attempts)').map(c=>c.name);
  if (!ecols.includes('score_pct')) db.exec('ALTER TABLE exam_attempts ADD COLUMN score_pct REAL');
  const cols = (table) => db.pragma(`table_info(${table})`).map(c => c.name);
  const add  = (table, col, type='TEXT') => {
    if (!cols(table).includes(col))
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
  };
  add('theory_blocks', 'title_fr');
  add('theory_blocks', 'description_fr');
  add('theory_blocks', 'content_fr');
  add('exercises',     'title_fr');
  add('exercises',     'description_fr');
  add('exam_defs',     'title_fr');
  add('exam_defs',     'description_fr');


  // Add numbers to Pre-Solo and P2 exercises if not already numbered
  const psExs = db.prepare("SELECT id, title, title_fr FROM exercises WHERE title LIKE 'Pre-Solo %' AND title NOT LIKE 'PS-%' ORDER BY order_idx").all();
  psExs.forEach((ex, i) => {
    const n = i + 1;
    const newTitle = ex.title.replace('Pre-Solo — ', `PS-${n} — `);
    const newTitleFr = (ex.title_fr || ex.title).replace('Pré-solo — ', `PS-${n} — `);
    db.prepare('UPDATE exercises SET title=?, title_fr=? WHERE id=?').run(newTitle, newTitleFr, ex.id);
  });
  const p2Exs = db.prepare("SELECT id, title, title_fr FROM exercises WHERE title LIKE 'P2 — %' AND title NOT LIKE 'P2-% —' ORDER BY order_idx").all();
  p2Exs.forEach((ex, i) => {
    const n = i + 1;
    const newTitle = ex.title.replace('P2 — ', `P2-${n} — `);
    const newTitleFr = (ex.title_fr || ex.title).replace('P2 — ', `P2-${n} — `);
    db.prepare('UPDATE exercises SET title=?, title_fr=? WHERE id=?').run(newTitle, newTitleFr, ex.id);
  });


  // Add new practical exam: Décollage pente école
  const existingExamTitles = db.prepare('SELECT title FROM exam_defs').all().map(e=>e.title);
  if (!existingExamTitles.includes('Slope School Launch — Practical Exam')) {
    db.prepare('INSERT INTO exam_defs (title,title_fr,description,description_fr,type,phase,order_idx) VALUES (?,?,?,?,?,?,?)').run(
      'Slope School Launch — Practical Exam',
      'Décollage pente école — Examen pratique',
      'Practical exam: controlled forward launch on a training slope with consistent inflation and proper brake timing. Assessed by instructor.',
      'Examen pratique : décollage face voile contrôlé sur pente école avec gonflage constant et temporisation correcte des freins. Évalué par l\'instructeur.',
      'practical', 'p1', 99
    );
  }

  // Fix Décollage pente école order — should be last
  db.prepare("UPDATE exam_defs SET order_idx=99 WHERE title='Slope School Launch — Practical Exam'").run();

  // Insert new practical exams if not present
  const existingExams = db.prepare('SELECT title FROM exam_defs').all().map(e=>e.title);
  const newExams = [
    { title:'Forward Zigzag Gate Challenge', title_fr:'Défi de portes zigzag face voile',
      description:'Practical exam: forward inflation through a series of ground handling gates in a zigzag pattern. Demonstrates precise directional control and canopy response during forward kiting.',
      description_fr:"Examen pratique : gonflage face voile à travers une série de portes en zigzag au sol. Démontre un contrôle directionnel précis lors du kite face voile.",
      type:'practical', phase:'p1', order_idx:5 },
    { title:'Reverse Zigzag Gate Challenge', title_fr:'Défi de portes zigzag dos voile',
      description:'Practical exam: reverse inflation through a series of ground handling gates in a zigzag pattern. Demonstrates precise canopy control and situational awareness during reverse kiting.',
      description_fr:"Examen pratique : gonflage dos voile à travers une série de portes en zigzag au sol. Démontre un contrôle précis de l'aile lors du kite dos voile.",
      type:'practical', phase:'p1', order_idx:6 },
  ];
  for (const ex of newExams) {
    if (!existingExams.includes(ex.title)) {
      db.prepare('INSERT INTO exam_defs (title,title_fr,description,description_fr,type,phase,order_idx) VALUES (@title,@title_fr,@description,@description_fr,@type,@phase,@order_idx)').run(ex);
    }
  }
  // Update forward/reverse launch descriptions to include 10x
  db.prepare("UPDATE exam_defs SET title='Forward Launch — Practical Exam (10x)', description='Practical exam: 10 consecutive consistent, controlled forward inflations and launches without instructor intervention.' WHERE title='Forward Launch — Practical Exam'").run();
  db.prepare("UPDATE exam_defs SET title_fr='Décollage face voile — Examen pratique (10x)', description_fr='Examen pratique : 10 décollages face voile consécutifs, constants et contrôlés sans intervention de l''instructeur.' WHERE title='Forward Launch — Practical Exam (10x)'").run();
  db.prepare("UPDATE exam_defs SET title='Reverse Launch — Practical Exam (10x)', description='Practical exam: 10 consecutive consistent, controlled reverse inflations and launches without instructor intervention.' WHERE title='Reverse Launch — Practical Exam'").run();
  db.prepare("UPDATE exam_defs SET title_fr='Décollage dos voile — Examen pratique (10x)', description_fr='Examen pratique : 10 décollages dos voile consécutifs, constants et contrôlés sans intervention de l''instructeur.' WHERE title='Reverse Launch — Practical Exam (10x)'").run();
}

function seedDefaults(db) {
  const exists = db.prepare('SELECT id FROM instructors LIMIT 1').get();
  if (!exists) {
    db.prepare(`INSERT INTO instructors (name, username, password_hash) VALUES (?, ?, ?)`)
      .run('Instructeur', 'pat', sha256('summit2024'));
  }
}

// ─────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────
export function sha256(s) { return createHash('sha256').update(s).digest('hex'); }

export function verifyStudentPin(name, pin) {
  const db = getDb();
  // Case-insensitive, trimmed — so minor capitalisation differences don't block login
  const student = db.prepare(
    "SELECT * FROM students WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND active = 1"
  ).get(String(name || '').trim());
  if (!student) return null;
  // Strip non-digits from PIN before hashing (matches how approval stores it)
  const pinDigits = String(pin || '').replace(/\D/g, '');
  if (!pinDigits || student.pin_hash !== sha256(pinDigits)) return null;
  return student;
}

export function createStudentSession(studentId) {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 7 * 86400000).toISOString();
  getDb().prepare('INSERT INTO student_sessions (token, student_id, expires_at) VALUES (?,?,?)').run(token, studentId, expires);
  return token;
}
export function getStudentSession(token) {
  if (!token) return null;
  return getDb().prepare("SELECT * FROM student_sessions WHERE token=? AND expires_at > datetime('now')").get(token);
}
export function archiveStudent(id) {
  getDb().prepare("UPDATE students SET active=0 WHERE id=?").run(id);
}
export function permanentlyDeleteStudent(id) {
  const db = getDb();
  const tables = [
    'exercise_logs','exam_attempts','theory_progress','quiz_results',
    'flight_media','flights','training_day_registrations','student_message_dismissals',
    'student_orders','student_bills','student_payments','student_sessions',
  ];
  for (const t of tables) {
    try { db.prepare(`DELETE FROM ${t} WHERE student_id=?`).run(id); }
    catch(e) { console.warn(`[delete] skip ${t}:`, e.message); }
  }
  try { db.prepare('DELETE FROM students WHERE id=?').run(id); }
  catch(e) { console.error('[delete] students:', e.message); }
}
export function deleteStudentSession(token) {
  getDb().prepare('DELETE FROM student_sessions WHERE token=?').run(token);
}

export function verifyInstructor(username, password) {
  return getDb().prepare('SELECT * FROM instructors WHERE username=? AND password_hash=?').get(username, sha256(password));
}
export function createInstructorSession(instructorId) {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 3600000).toISOString();
  getDb().prepare('INSERT INTO instructor_sessions (token, instructor_id, expires_at) VALUES (?,?,?)').run(token, instructorId, expires);
  return token;
}
export function getInstructorSession(token) {
  if (!token) return null;
  return getDb().prepare("SELECT * FROM instructor_sessions WHERE token=? AND expires_at > datetime('now')").get(token);
}
export function deleteInstructorSession(token) {
  getDb().prepare('DELETE FROM instructor_sessions WHERE token=?').run(token);
}

// ─────────────────────────────────────────────────────
// STUDENTS
// ─────────────────────────────────────────────────────

export function runV48Migrations(db) {
  // Message reads — track which student read which message
  db.exec(`CREATE TABLE IF NOT EXISTS message_reads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL REFERENCES student_messages(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, student_id)
  )`);

  // Library items — study tools documents
  db.exec(`CREATE TABLE IF NOT EXISTS library_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT,
    file_url    TEXT NOT NULL,
    file_type   TEXT DEFAULT 'pdf',
    order_idx   INTEGER DEFAULT 0,
    uploaded_by INTEGER REFERENCES instructors(id),
    active      INTEGER DEFAULT 1,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Student total due (for billing)
  const scols = db.pragma('table_info(students)').map(c=>c.name);
  if (!scols.includes('total_due')) db.exec('ALTER TABLE students ADD COLUMN total_due REAL DEFAULT 0');
  if (!scols.includes('bill_url')) db.exec('ALTER TABLE students ADD COLUMN bill_url TEXT');

  // Debriefing viewed by student
  try {
    const dcols = db.pragma('table_info(flight_debriefings)').map(c=>c.name);
    if (!dcols.includes('student_viewed')) db.exec('ALTER TABLE flight_debriefings ADD COLUMN student_viewed INTEGER DEFAULT 0');
    if (!dcols.includes('student_acknowledged')) db.exec('ALTER TABLE flight_debriefings ADD COLUMN student_acknowledged INTEGER DEFAULT 0');
    if (!dcols.includes('student_acknowledged_at')) db.exec('ALTER TABLE flight_debriefings ADD COLUMN student_acknowledged_at TEXT');
    if (!dcols.includes('instructor_seen_ack')) db.exec('ALTER TABLE flight_debriefings ADD COLUMN instructor_seen_ack INTEGER DEFAULT 0');
  } catch(e) {}

  // Seed FFVL manual in library (once)
  try {
    const libCount = db.prepare("SELECT COUNT(*) as n FROM library_items WHERE title='Manuel FFVL'").get()?.n || 0;
    if (!libCount) {
      db.prepare("INSERT INTO library_items (title,description,file_url,file_type,order_idx) VALUES (?,?,?,?,?)").run(
        'Manuel FFVL',
        'Manuel officiel de formation FFVL - Parapente',
        '/Manuel-FFVL.pdf',
        'pdf',
        0
      );
    }
  } catch(e) { console.error('[v48] library seed:', e.message); }

  // Quiz question source tracking
  try {
    const qcols = db.pragma('table_info(quiz_questions)').map(c=>c.name);
    if (!qcols.includes('source')) db.exec("ALTER TABLE quiz_questions ADD COLUMN source TEXT DEFAULT 'local'");
    if (!qcols.includes('needs_review')) db.exec("ALTER TABLE quiz_questions ADD COLUMN needs_review INTEGER DEFAULT 0");
  } catch(e) {}

  // Training days: separate app/telegram publish flags
  try {
    const tcols = db.pragma('table_info(training_days)').map(c=>c.name);
    if (!tcols.includes('published_to_app')) db.exec('ALTER TABLE training_days ADD COLUMN published_to_app INTEGER DEFAULT 0');
    if (!tcols.includes('published_to_telegram')) db.exec('ALTER TABLE training_days ADD COLUMN published_to_telegram INTEGER DEFAULT 0');
    // Migrate existing: if published=1, set published_to_app=1
    db.exec('UPDATE training_days SET published_to_app=1 WHERE published=1 AND published_to_app=0');
    if (tcols.includes('telegram_sent')) db.exec('UPDATE training_days SET published_to_telegram=1 WHERE telegram_sent=1 AND published_to_telegram=0');
  } catch(e) {}
}


// ─── MESSAGE READS ───────────────────────────────────────────────────────────
export function markMessageRead(messageId, studentId) {
  try { getDb().prepare('INSERT OR IGNORE INTO message_reads (message_id,student_id) VALUES (?,?)').run(messageId, studentId); } catch(e) {}
}
export function getMessageReaders(messageId) {
  try { return getDb().prepare('SELECT s.id,s.name,mr.read_at FROM message_reads mr JOIN students s ON s.id=mr.student_id WHERE mr.message_id=? ORDER BY mr.read_at').all(messageId); } catch(e) { return []; }
}
export function getUnreadMessages(studentId) {
  try {
    return getDb().prepare(`
      SELECT m.* FROM student_messages m
      WHERE m.id NOT IN (SELECT message_id FROM message_reads WHERE student_id=?)
      ORDER BY m.created_at DESC
    `).all(studentId);
  } catch(e) { return []; }
}

// ─── LIBRARY ITEMS ────────────────────────────────────────────────────────────
export function getLibraryItems() {
  try { return getDb().prepare("SELECT * FROM library_items WHERE active=1 ORDER BY order_idx,created_at").all(); } catch(e) { return []; }
}
export function addLibraryItem({ title, description, file_url, file_type, uploaded_by }) {
  return getDb().prepare('INSERT INTO library_items (title,description,file_url,file_type,uploaded_by) VALUES (?,?,?,?,?)').run(title, description||'', file_url, file_type||'pdf', uploaded_by||null).lastInsertRowid;
}
export function deleteLibraryItem(id) {
  getDb().prepare('UPDATE library_items SET active=0 WHERE id=?').run(id);
}

// ─── BILLING ─────────────────────────────────────────────────────────────────
export function setStudentTotalDue(studentId, amount) {
  getDb().prepare('UPDATE students SET total_due=? WHERE id=?').run(Number(amount)||0, studentId);
}
export function getStudentBillingInfo(studentId) {
  const db = getDb();
  const student = db.prepare('SELECT total_due, bill_url FROM students WHERE id=?').get(studentId);
  const totalDue = student?.total_due || 0;
  const billUrl  = student?.bill_url  || null;
  const payments = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE student_id=? AND status='paid'").get(studentId);
  const totalPaid = payments?.total || 0;
  return { totalDue, totalPaid, balance: totalDue - totalPaid, billUrl };
}
export function setStudentBillUrl(studentId, url) {
  getDb().prepare('UPDATE students SET bill_url=? WHERE id=?').run(url || null, studentId);
}

// ─── CONSOLIDATED ORDERS ──────────────────────────────────────────────────────
export function getAllOrdersWithStudents() {
  try {
    return getDb().prepare(`
      SELECT o.*, s.name as student_name
      FROM student_orders o JOIN students s ON s.id=o.student_id
      ORDER BY CASE o.status WHEN 'pending' THEN 0 WHEN 'responded' THEN 1 ELSE 2 END, o.created_at DESC
    `).all();
  } catch(e) { return []; }
}

// ─── PLANNING PUBLISH ─────────────────────────────────────────────────────────
export function publishDayToApp(id) {
  getDb().prepare('UPDATE training_days SET published_to_app=1,published=1 WHERE id=?').run(id);
}
export function unpublishDayFromApp(id) {
  getDb().prepare('UPDATE training_days SET published_to_app=0,published=0 WHERE id=?').run(id);
}
export function markDayTelegramSent(id) {
  getDb().prepare('UPDATE training_days SET published_to_telegram=1,telegram_sent=1 WHERE id=?').run(id);
}

// ─── DEBRIEFING NOTIFICATIONS ─────────────────────────────────────────────────
export function markDebriefingViewed(debriefId) {
  try {
    getDb().prepare(
      "UPDATE flight_debriefings SET student_viewed=1, viewed_at=datetime('now') WHERE id=?"
    ).run(debriefId);
  } catch(e) {}
}

export function getDebriefingById(id) {
  try { return getDb().prepare('SELECT * FROM flight_debriefings WHERE id=?').get(id); } catch(e) { return null; }
}
export function acknowledgeDebriefing(debriefId) {
  try { getDb().prepare("UPDATE flight_debriefings SET student_acknowledged=1, student_acknowledged_at=datetime('now') WHERE id=?").run(debriefId); } catch(e) {}
}
export function getUnviewedDebriefings(studentId) {
  try {
    return getDb().prepare(`
      SELECT d.*, f.date as flight_date, f.site as flight_site
      FROM flight_debriefings d JOIN flights f ON f.id=d.flight_id
      WHERE d.student_id=? AND d.status='done' AND d.student_viewed=0
      ORDER BY d.created_at DESC
    `).all(studentId);
  } catch(e) { return []; }
}

// ─── CONFIDENCE TREND ─────────────────────────────────────────────────────────
export function getConfidenceTrend(studentId) {
  // Uses mental_condition (1-5 "how are you feeling") from preflight form.
  // Falls back to confidence_rating (post-flight self-assessment) if no mental data.
  try {
    const db = getDb();
    // Primary: pre-flight mental state — honest self-assessment before every flight
    let rows = db.prepare(
      `SELECT mental_condition as rating, date
       FROM flights
       WHERE student_id=? AND mental_condition IS NOT NULL AND mental_condition > 0
         AND status='complete'
       ORDER BY date ASC`
    ).all(studentId);

    // Fallback: post-flight confidence rating
    if (!rows.length) {
      rows = db.prepare(
        `SELECT confidence_rating as rating, date
         FROM flights
         WHERE student_id=? AND confidence_rating IS NOT NULL
           AND status='complete'
         ORDER BY date ASC`
      ).all(studentId);
    }

    if (!rows.length) return { trend: 'neutral', baseline: null, last: null, data: [] };
    if (rows.length < 2) return { trend: 'neutral', baseline: null, last: rows[0]?.rating || null, data: rows };

    const half     = Math.ceil(rows.length / 2);
    const baseline = rows.slice(0, half).reduce((s,r) => s + r.rating, 0) / half;
    const recent   = rows.slice(-Math.min(3, rows.length)).reduce((s,r) => s + r.rating, 0) / Math.min(3, rows.length);
    const last     = rows[rows.length - 1].rating;
    const trend    = recent > baseline + 0.3 ? 'up' : recent < baseline - 0.3 ? 'down' : 'stable';
    return { trend, baseline: +(baseline.toFixed(1)), recent: +(recent.toFixed(1)), last, data: rows };
  } catch(e) {
    console.error('[getConfidenceTrend]', e.message);
    return { trend: 'neutral', baseline: null, last: null, data: [] };
  }
}


// ─── UNDO ACTIONS ─────────────────────────────────────────────────────────────
export function deleteExerciseLog(logId) {
  try { getDb().prepare('DELETE FROM exercise_logs WHERE id=?').run(logId); return true; } catch(e) { return false; }
}
export function deletePaymentLog(paymentId) {
  try { getDb().prepare("DELETE FROM payments WHERE id=? AND status='pending'").run(paymentId); return true; } catch(e) { return false; }
}
export function getRecentExerciseLogs(studentId, minutesBack=5) {
  try {
    return getDb().prepare(`
      SELECT el.id, el.exercise_id, el.date, el.status, ex.title, ex.title_fr
      FROM exercise_logs el JOIN exercises ex ON ex.id=el.exercise_id
      WHERE el.student_id=? AND el.created_at >= datetime('now','-${minutesBack} minutes')
      ORDER BY el.created_at DESC LIMIT 10
    `).all(studentId);
  } catch(e) { return []; }
}

// ─── INSTRUCTOR ORDERS CONSOLIDATED ──────────────────────────────────────────
export function getPendingOrdersAll() {
  try {
    return getDb().prepare(`
      SELECT o.*, s.name as student_name FROM student_orders o
      JOIN students s ON s.id=o.student_id
      WHERE o.status IN ('pending','responded')
      ORDER BY o.created_at DESC
    `).all();
  } catch(e) { return []; }
}

// ─── INSTRUCTOR LIBRARY MANAGEMENT ───────────────────────────────────────────
export function getLibraryItemsAll() {
  try { return getDb().prepare('SELECT * FROM library_items ORDER BY order_idx,created_at').all(); } catch(e) { return []; }
}

export function getAllStudents() {
  try {
    return getDb().prepare("SELECT * FROM students WHERE active=1 ORDER BY name ASC").all();
  } catch(e) { console.error('[getAllStudents]', e.message); return []; }
}
export function getArchivedStudents() {
  try {
    return getDb().prepare("SELECT * FROM students WHERE active=0 ORDER BY name ASC").all();
  } catch(e) { console.error('[getArchivedStudents]', e.message); return []; }
}
export function getStudent(id) {
  return getDb().prepare('SELECT * FROM students WHERE id=?').get(id);
}
export function createStudent({ name, email, phone, pin, enrollment_date, notes, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship }) {
  const r = getDb().prepare(`
    INSERT INTO students (name, email, phone, pin_hash, enrollment_date, notes, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(name, email||null, phone||null, sha256(String(pin)), enrollment_date, notes||null,
         emergency_contact_name||null, emergency_contact_phone||null, emergency_contact_relationship||null);
  return r.lastInsertRowid;
}
export function updateStudentPin(id, newPin) {
  getDb().prepare('UPDATE students SET pin_hash=? WHERE id=?').run(sha256(String(newPin)), id);
}
export function getStudentNames() {
  return getDb().prepare('SELECT id, name FROM students WHERE active=1 ORDER BY name').all();
}

// ─────────────────────────────────────────────────────
// THEORY
// ─────────────────────────────────────────────────────
export function getTheoryBlocks() {
  return getDb().prepare('SELECT * FROM theory_blocks ORDER BY phase, order_idx, id').all();
}
export function getTheoryBlock(id) {
  return getDb().prepare('SELECT * FROM theory_blocks WHERE id=?').get(id);
}
export function createTheoryBlock(d) {
  return getDb().prepare(`INSERT INTO theory_blocks (title,title_fr,description,description_fr,content,content_fr,phase,order_idx) VALUES (@title,@title_fr,@description,@description_fr,@content,@content_fr,@phase,@order_idx)`).run(d).lastInsertRowid;
}
export function updateTheoryBlock(id, d) {
  getDb().prepare(`UPDATE theory_blocks SET title=@title,description=@description,content=@content,phase=@phase,order_idx=@order_idx WHERE id=@id`).run({...d,id});
}
export function deleteTheoryBlock(id) {
  getDb().prepare('DELETE FROM theory_blocks WHERE id=?').run(id);
}
export function getTheoryProgress(studentId) {
  return getDb().prepare(`
    SELECT tb.*, tp.completed, tp.completed_at
    FROM theory_blocks tb
    LEFT JOIN theory_progress tp ON tp.block_id=tb.id AND tp.student_id=?
    ORDER BY tb.phase, tb.order_idx, tb.id
  `).all(studentId);
}
export function markTheoryComplete(studentId, blockId) {
  getDb().prepare(`
    INSERT INTO theory_progress (student_id, block_id, completed, completed_at)
    VALUES (?,?,1,datetime('now'))
    ON CONFLICT(student_id,block_id) DO UPDATE SET completed=1, completed_at=datetime('now')
  `).run(studentId, blockId);
}
export function unmarkTheoryComplete(studentId, blockId) {
  getDb().prepare(`UPDATE theory_progress SET completed=0, completed_at=NULL WHERE student_id=? AND block_id=?`).run(studentId, blockId);
}

// ─────────────────────────────────────────────────────
// EXERCISES
// ─────────────────────────────────────────────────────
export function getExercises() {
  return getDb().prepare('SELECT * FROM exercises ORDER BY category, order_idx, id').all();
}
export function createExercise(d) {
  return getDb().prepare(`INSERT INTO exercises (title,title_fr,description,description_fr,category,order_idx,requires_signoff) VALUES (@title,@title_fr,@description,@description_fr,@category,@order_idx,@requires_signoff)`).run(d).lastInsertRowid;
}
export function updateExercise(id, d) {
  getDb().prepare(`UPDATE exercises SET title=@title,description=@description,category=@category,order_idx=@order_idx WHERE id=@id`).run({...d,id});
}
export function deleteExercise(id) {
  getDb().prepare('DELETE FROM exercises WHERE id=?').run(id);
}
export function getExerciseLogsForStudent(studentId) {
  return getDb().prepare(`
    WITH ranked AS (
      SELECT ex.id as ex_id, ex.title as exercise_title, ex.title_fr as exercise_title_fr,
             ex.category, ex.description as exercise_desc, ex.description_fr as exercise_desc_fr,
             ex.order_idx,
             el.id as log_id, el.status, el.attempt_notes, el.instructor_notes, el.date,
             el.signed_off_at, el.signed_off_by,
             i.name as instructor_name,
             ROW_NUMBER() OVER (
               PARTITION BY ex.id
               ORDER BY CASE el.status WHEN 'passed' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END,
               COALESCE(el.id, 0) DESC
             ) as rn
      FROM exercises ex
      LEFT JOIN exercise_logs el ON el.exercise_id=ex.id AND el.student_id=?
      LEFT JOIN instructors i ON i.id=el.signed_off_by
    )
    SELECT * FROM ranked WHERE rn=1
    ORDER BY category, order_idx, ex_id
  `).all(studentId);
}
export function logExercise(d) {
  return getDb().prepare(`INSERT INTO exercise_logs (student_id,exercise_id,date,attempt_notes,status) VALUES (@student_id,@exercise_id,@date,@attempt_notes,@status)`).run(d).lastInsertRowid;
}
export function getPendingSignoffs() {
  return getDb().prepare(`
    SELECT el.*, s.name as student_name, ex.title as exercise_title, ex.category
    FROM exercise_logs el
    JOIN students s ON s.id=el.student_id
    JOIN exercises ex ON ex.id=el.exercise_id
    WHERE el.status='pending'
    ORDER BY el.created_at DESC
  `).all();
}
export function signOffExercise(logId, instructorId, status, notes) {
  getDb().prepare(`UPDATE exercise_logs SET status=?,instructor_notes=?,signed_off_by=?,signed_off_at=datetime('now') WHERE id=?`).run(status, notes||null, instructorId, logId);
}

// ─────────────────────────────────────────────────────
// EXAMS
// ─────────────────────────────────────────────────────
export function getExamDefs() {
  return getDb().prepare('SELECT * FROM exam_defs ORDER BY phase, order_idx, id').all();
}
export function createExamDef(d) {
  return getDb().prepare(`INSERT INTO exam_defs (title,title_fr,description,description_fr,type,phase,order_idx) VALUES (@title,@title_fr,@description,@description_fr,@type,@phase,@order_idx)`).run(d).lastInsertRowid;
}
export function deleteExamDef(id) {
  getDb().prepare('DELETE FROM exam_defs WHERE id=?').run(id);
}
export function getExamAttemptsForStudent(studentId) {
  return getDb().prepare(`
    SELECT ea.*, ed.title as exam_title, ed.type as exam_type, ed.phase,
           i.name as instructor_name
    FROM exam_defs ed
    LEFT JOIN exam_attempts ea ON ea.exam_id=ed.id AND ea.student_id=?
    LEFT JOIN instructors i ON i.id=ea.signed_off_by
    ORDER BY ed.phase, ed.order_idx, ed.id
  `).all(studentId);
}
export function logExamAttempt(d) {
  return getDb().prepare(`INSERT INTO exam_attempts (student_id,exam_id,date,score,max_score,passed,student_notes) VALUES (@student_id,@exam_id,@date,@score,@max_score,@passed,@student_notes)`).run(d).lastInsertRowid;
}
export function getPendingExamSignoffs() {
  return getDb().prepare(`
    SELECT ea.*, s.name as student_name, ed.title as exam_title, ed.type as exam_type
    FROM exam_attempts ea
    JOIN students s ON s.id=ea.student_id
    JOIN exam_defs ed ON ed.id=ea.exam_id
    WHERE ea.signed_off_at IS NULL
    ORDER BY ea.created_at DESC
  `).all();
}
export function signOffExam(attemptId, instructorId, passed, notes, scorePct) {
  getDb().prepare("UPDATE exam_attempts SET passed=?,instructor_notes=?,signed_off_by=?,signed_off_at=datetime('now'),score_pct=? WHERE id=?").run(passed, notes||null, instructorId, scorePct||null, attemptId);
}

// ─────────────────────────────────────────────────────
// FLIGHTS
// ─────────────────────────────────────────────────────
export function getFlightsForStudent(studentId) {
  return getDb().prepare(`SELECT * FROM flights WHERE student_id=? ORDER BY date DESC, created_at DESC`).all(studentId);
}
export function getPendingFlight(studentId) {
  return getDb().prepare(`SELECT * FROM flights WHERE student_id=? AND status IN ('preflight','postflight_pending') ORDER BY created_at DESC LIMIT 1`).get(studentId);
}
export function getFlight(id) {
  return getDb().prepare('SELECT * FROM flights WHERE id=?').get(id);
}
export function getFlightByToken(token) {
  return getDb().prepare('SELECT * FROM flights WHERE share_token=?').get(token);
}
export function startFlight(d) {
  const token = randomBytes(12).toString('hex');
  return getDb().prepare(`
    INSERT INTO flights (student_id,date,status,site,wind_speed,wind_direction,glider,conditions_notes,mental_condition,confidence_rating,share_token)
    VALUES (@student_id,@date,'preflight',@site,@wind_speed,@wind_direction,@glider,@conditions_notes,@mental_condition,@confidence_rating,@share_token)
  `).run({...d, share_token: token, confidence_rating: d.confidence_rating || null}).lastInsertRowid;
}
export function completeFlight(id, d) {
  getDb().prepare(`
    UPDATE flights SET
      status='complete', launch_quality=@launch_quality, landing_quality=@landing_quality,
      flight_type=@flight_type, launch_type=@launch_type, thermals_caught=@thermals_caught, meters_gained=@meters_gained,
      exercises_done=@exercises_done, what_went_well=@what_went_well, what_to_improve=@what_to_improve,
      next_goals=@next_goals, personal_notes=@personal_notes,
      landing_site=@landing_site, start_time=@start_time, end_time=@end_time,
      confidence_rating=@confidence_rating,
      duration_seconds=COALESCE(@duration_seconds, duration_seconds)
    WHERE id=@id
  `).run({...d, id});
}
export function updateFlightGPS(id, d) {
  getDb().prepare(`
    UPDATE flights SET
      duration_seconds=@duration_seconds, distance_km=@distance_km,
      max_altitude_m=@max_altitude_m, takeoff_lat=@takeoff_lat, takeoff_lon=@takeoff_lon,
      landing_lat=@landing_lat, landing_lon=@landing_lon, track_geojson=@track_geojson
    WHERE id=@id
  `).run({...d, id});
}
export function deleteFlight(id) {
  getDb().prepare('DELETE FROM flights WHERE id=?').run(id);
}
export function getAllFlights() {
  const db = getDb();
  // Ensure columns exist before querying
  const cols = db.pragma('table_info(flights)').map(c=>c.name);
  const safe = (col, alias) => cols.includes(col) ? `f.${col}${alias?' as '+alias:''}` : `null as ${alias||col}`;
  return db.prepare(`
    SELECT f.id, f.student_id, f.date, f.status, f.site,
           f.flight_type, f.duration_seconds, f.distance_km, f.max_altitude_m,
           f.launch_quality, f.landing_quality, f.meters_gained,
           f.what_went_well, f.what_to_improve, f.personal_notes,
           f.exercises_done, f.track_geojson,
           ${cols.includes('landing_site')  ? 'f.landing_site,'   : 'null as landing_site,'}
           ${cols.includes('start_time')    ? 'f.start_time,'     : 'null as start_time,'}
           ${cols.includes('end_time')      ? 'f.end_time,'       : 'null as end_time,'}
           ${cols.includes('launch_type')   ? 'f.launch_type,'    : 'null as launch_type,'}
           s.name as student_name
    FROM flights f JOIN students s ON s.id=f.student_id
    WHERE f.status='complete'
    ORDER BY f.date DESC, f.created_at DESC
  `).all();
}

// ─────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────
export function getInstructorDashboard() {
  const db = getDb();
  return {
    students:      db.prepare('SELECT COUNT(*) as n FROM students WHERE active=1').get().n,
    flights:       db.prepare("SELECT COUNT(*) as n FROM flights WHERE status='complete'").get().n,
    pending_signoffs: db.prepare("SELECT COUNT(*) as n FROM exercise_logs WHERE status='pending'").get().n + db.prepare("SELECT COUNT(*) as n FROM exam_attempts WHERE signed_off_at IS NULL").get().n,
    recent_flights: db.prepare(`
      SELECT f.*, s.name as student_name FROM flights f
      JOIN students s ON s.id=f.student_id
      WHERE f.status='complete' ORDER BY f.created_at DESC LIMIT 8
    `).all(),
    active_students: getAllStudents().slice(0, 6),
    pending_ex: getPendingSignoffs().slice(0, 5),
    pending_exam: getPendingExamSignoffs().slice(0, 5)
  };
}
export function getStudentDashboard(studentId) {
  const db = getDb();
  const theory     = getTheoryProgress(studentId);
  const exercises  = getExerciseLogsForStudent(studentId);
  const exams      = getExamAttemptsForStudent(studentId);
  const flights    = getFlightsForStudent(studentId);
  const pending    = getPendingFlight(studentId);

  const theoryDone  = theory.filter(t => t.completed).length;
  const exDone      = exercises.filter(e => e.status === 'passed').length;
  const examsDone   = exams.filter(e => e.passed === 1 && e.signed_off_at).length;
  const flightCount = flights.filter(f => f.status === 'complete').length;
  const airtime     = flights.filter(f=>f.status==='complete').reduce((a,f)=>a+(f.duration_seconds||0),0);

  return {
    theory, exercises, exams, flights, pending,
    stats: {
      theoryDone, theoryTotal: theory.length,
      exDone, exTotal: exercises.length,
      examsDone, examsTotal: exams.length,
      flightCount, airtime
    }
  };
}
export function getInstructor(id) {
  return getDb().prepare('SELECT id, name, username FROM instructors WHERE id=?').get(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// EQUIPMENT
// ─────────────────────────────────────────────────────────────────────────────
export function getStudentEquipment(studentId) {
  return getDb().prepare('SELECT * FROM student_equipment WHERE student_id=? ORDER BY id DESC LIMIT 1').get(studentId);
}
export function saveStudentEquipment(studentId, d) {
  const db = getDb();
  const exists = db.prepare('SELECT id FROM student_equipment WHERE student_id=?').get(studentId);
  // Ensure all named parameters exist with null defaults — better-sqlite3 throws otherwise
  const ALL_FIELDS = [
    'glider_make','glider_model','glider_size','glider_flat_area','glider_projected_area',
    'glider_weight','harness','harness_weight','reserve','reserve_weight','pilot_weight',
    'loading_min','loading_max','notes',
    'wing_color_1','wing_color_2','wing_le_color','harness_color'
  ];
  const safe = { student_id: studentId };
  for (const f of ALL_FIELDS) safe[f] = (d?.[f] !== undefined ? d[f] : null);

  const fields = ALL_FIELDS.map(f => `${f}=@${f}`).join(',');

  if (exists) {
    db.prepare(`UPDATE student_equipment SET ${fields} WHERE student_id=@student_id`).run(safe);
  } else {
    const cols = ['student_id', ...ALL_FIELDS].join(',');
    const vals = ['@student_id', ...ALL_FIELDS.map(f => '@'+f)].join(',');
    db.prepare(`INSERT INTO student_equipment (${cols}) VALUES (${vals})`).run(safe);
  }
}

export function saveStudentColours(studentId, wing_color_1, wing_le_color, harness_color) {
  const db = getDb();
  // Ensure columns exist (safe for older deployed DBs)
  for (const col of ['wing_color_1 TEXT','wing_color_2 TEXT','wing_le_color TEXT','harness_color TEXT']) {
    try { db.exec('ALTER TABLE student_equipment ADD COLUMN ' + col); } catch(e) {}
  }
  const exists = db.prepare('SELECT id FROM student_equipment WHERE student_id=?').get(studentId);
  if (exists) {
    db.prepare(
      'UPDATE student_equipment SET wing_color_1=?, wing_le_color=?, harness_color=? WHERE student_id=?'
    ).run(wing_color_1 || null, wing_le_color || null, harness_color || null, studentId);
  } else {
    db.prepare(
      'INSERT INTO student_equipment (student_id, wing_color_1, wing_le_color, harness_color) VALUES (?,?,?,?)'
    ).run(studentId, wing_color_1 || null, wing_le_color || null, harness_color || null);
  }
}

export function getPendingByStudent() {
  const db = getDb();
  const exercises = db.prepare(`
    SELECT el.*, s.name as student_name, s.id as student_id,
           ex.title as exercise_title, ex.title_fr as exercise_title_fr, ex.category
    FROM exercise_logs el
    JOIN students s ON s.id=el.student_id
    JOIN exercises ex ON ex.id=el.exercise_id
    WHERE el.status='pending'
    ORDER BY s.name, el.created_at DESC
  `).all();
  const exams = db.prepare(`
    SELECT ea.*, s.name as student_name, s.id as student_id,
           ed.title as exam_title, ed.title_fr as exam_title_fr, ed.type as exam_type, ed.phase
    FROM exam_attempts ea
    JOIN students s ON s.id=ea.student_id
    JOIN exam_defs ed ON ed.id=ea.exam_id
    WHERE ea.signed_off_at IS NULL
    ORDER BY s.name, ea.created_at DESC
  `).all();

  // Group by student
  const byStudent = {};
  for (const ex of exercises) {
    if (!byStudent[ex.student_id]) byStudent[ex.student_id] = { student_id: ex.student_id, student_name: ex.student_name, exercises: [], exams: [] };
    byStudent[ex.student_id].exercises.push(ex);
  }
  for (const ea of exams) {
    if (!byStudent[ea.student_id]) byStudent[ea.student_id] = { student_id: ea.student_id, student_name: ea.student_name, exercises: [], exams: [] };
    byStudent[ea.student_id].exams.push(ea);
  }
  return Object.values(byStudent).sort((a,b) => a.student_name.localeCompare(b.student_name));
}

export function getTodayActivity() {
  const db = getDb();
  const today = new Date().toISOString().slice(0,10);
  
  const exercises = db.prepare(`
    SELECT el.id, el.status, el.attempt_notes, el.created_at,
           s.id as student_id, s.name as student_name,
           ex.title as exercise_title, ex.title_fr as exercise_title_fr, ex.category
    FROM exercise_logs el
    JOIN students s ON s.id=el.student_id
    JOIN exercises ex ON ex.id=el.exercise_id
    WHERE el.status='pending' AND date(el.created_at)=?
    ORDER BY s.name, el.created_at DESC
  `).all(today);
  
  const exams = db.prepare(`
    SELECT ea.id, ea.student_notes, ea.created_at,
           s.id as student_id, s.name as student_name,
           ed.title as exam_title, ed.title_fr as exam_title_fr, ed.type as exam_type, ed.phase
    FROM exam_attempts ea
    JOIN students s ON s.id=ea.student_id
    JOIN exam_defs ed ON ed.id=ea.exam_id
    WHERE ea.signed_off_at IS NULL AND date(ea.created_at)=?
    ORDER BY s.name, ea.created_at DESC
  `).all(today);

  // Group by student
  const byStudent = {};
  for (const ex of exercises) {
    if (!byStudent[ex.student_id]) byStudent[ex.student_id] = { student_id: ex.student_id, student_name: ex.student_name, exercises: [], exams: [] };
    byStudent[ex.student_id].exercises.push(ex);
  }
  for (const ea of exams) {
    if (!byStudent[ea.student_id]) byStudent[ea.student_id] = { student_id: ea.student_id, student_name: ea.student_name, exercises: [], exams: [] };
    byStudent[ea.student_id].exams.push(ea);
  }
  return Object.values(byStudent).sort((a,b) => a.student_name.localeCompare(b.student_name));
}

export function signOffAllForStudent(studentId, instructorId) {
  const db = getDb();
  // Sign off ALL of this student's pending exercises (not just today's — the
  // dashboard shows every pending item, so "Approve All" must match all of them).
  db.prepare(`UPDATE exercise_logs SET status='passed', signed_off_by=?, signed_off_at=datetime('now'), instructor_notes='Approuvé en lot'
    WHERE student_id=? AND status='pending'`).run(instructorId, studentId);
  // Sign off all pending exam attempts
  db.prepare(`UPDATE exam_attempts SET passed=1, signed_off_by=?, signed_off_at=datetime('now'), instructor_notes='Approuvé en lot'
    WHERE student_id=? AND signed_off_at IS NULL`).run(instructorId, studentId);
}

export function getStudentProgressMap(studentId) {
  const db = getDb();
  const exercises = db.prepare(`
    WITH ranked AS (
      SELECT ex.id, ex.title, ex.category, ex.order_idx,
             el.status, el.signed_off_at,
             ROW_NUMBER() OVER (
               PARTITION BY ex.id
               ORDER BY CASE el.status WHEN 'passed' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END,
               COALESCE(el.id, 0) DESC
             ) as rn
      FROM exercises ex
      LEFT JOIN exercise_logs el ON el.exercise_id=ex.id AND el.student_id=?
    )
    SELECT id, title, category, order_idx, status, signed_off_at
    FROM ranked WHERE rn=1
    ORDER BY category, order_idx
  `).all(studentId);
  
  const exams = db.prepare(`
    SELECT ed.id, ed.title, ed.type, ed.phase,
           ea.passed, ea.signed_off_at, ea.score_pct
    FROM exam_defs ed
    LEFT JOIN exam_attempts ea ON ea.exam_id=ed.id AND ea.student_id=?
      AND ea.signed_off_at IS NOT NULL
    ORDER BY ed.phase, ed.order_idx
  `).all(studentId);
  
  return { exercises, exams };
}

export function getAllStudentsProgress() {
  const db = getDb();
  const students = db.prepare('SELECT id, name FROM students WHERE active=1 ORDER BY name').all();
  return students.map(s => {
    const exTotal  = db.prepare('SELECT COUNT(DISTINCT id) as n FROM exercises').get().n;
    const exPassed = db.prepare("SELECT COUNT(DISTINCT exercise_id) as n FROM exercise_logs WHERE student_id=? AND status='passed'").get(s.id).n;
    const exPending= db.prepare("SELECT COUNT(DISTINCT exercise_id) as n FROM exercise_logs WHERE student_id=? AND status='pending'").get(s.id).n;
    const thTotal  = db.prepare('SELECT COUNT(*) as n FROM theory_blocks').get().n;
    const thDone   = db.prepare('SELECT COUNT(*) as n FROM theory_progress WHERE student_id=? AND completed=1').get(s.id).n;
    const flights  = db.prepare("SELECT COUNT(*) as n FROM flights WHERE student_id=? AND status='complete'").get(s.id).n;
    return { ...s, exTotal, exPassed, exPending, thTotal, thDone, flights };
  });
}

export function getExerciseLogCountForFlight(studentId, exerciseId) {
  return getDb().prepare('SELECT COUNT(*) as n FROM exercise_logs WHERE student_id=? AND exercise_id=? AND date=?').get(studentId, exerciseId, new Date().toISOString().slice(0,10)).n;
}

export function getExerciseLogsByFlight(studentId) {
  // Returns exercise_id -> count map for today
  const rows = getDb().prepare("SELECT exercise_id, COUNT(*) as cnt FROM exercise_logs WHERE student_id=? AND date=? GROUP BY exercise_id").all(studentId, new Date().toISOString().slice(0,10));
  const map = {};
  for (const r of rows) map[r.exercise_id] = r.cnt;
  return map;
}

export function cancelExerciseLog(logId, studentId) {
  // Only allow cancelling pending logs owned by this student
  const db = getDb();
  const log = db.prepare("SELECT id FROM exercise_logs WHERE id=? AND student_id=? AND status='pending'").get(logId, studentId);
  if (!log) return false;
  db.prepare("DELETE FROM exercise_logs WHERE id=?").run(logId);
  return true;
}

export function cancelExamAttempt(attemptId, studentId) {
  // Only allow cancelling unsigned attempts owned by this student
  const db = getDb();
  const attempt = db.prepare("SELECT id FROM exam_attempts WHERE id=? AND student_id=? AND signed_off_at IS NULL").get(attemptId, studentId);
  if (!attempt) return false;
  db.prepare("DELETE FROM exam_attempts WHERE id=?").run(attemptId);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// v42 MIGRATIONS — new tables + columns
// ─────────────────────────────────────────────────────────────────────────────
export function runV42Migrations(db) {
  const add = (table, col, type='TEXT') => {
    const cols = db.pragma(`table_info(${table})`).map(c=>c.name);
    if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
  };
  // Students contact info
  add('students','emergency_contact_name');
  add('students','emergency_contact_phone');
  add('students','emergency_contact_relationship');
  // Equipment inspection dates
  add('student_equipment','reserve_repack_date');
  add('student_equipment','harness_inspection_date');
  add('student_equipment','glider_inspection_date');
  add('student_equipment','glider_hours','REAL');
  // Flights: confidence + first flight flag
  add('flights','confidence_rating','INTEGER');
  // Exam: photo proof
  add('exam_attempts','photo_url');

  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      amount     REAL NOT NULL,
      date       DATE DEFAULT (date('now')),
      method     TEXT DEFAULT 'interac',
      notes      TEXT,
      status     TEXT DEFAULT 'paid',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS training_days (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      date            DATE NOT NULL,
      instructor_id   INTEGER REFERENCES instructors(id),
      activity_types  TEXT DEFAULT '[]',
      launch_site     TEXT,
      max_students    INTEGER DEFAULT 12,
      weather_summary TEXT,
      plan_text       TEXT,
      wind_min        REAL,
      wind_max        REAL,
      wind_dir        TEXT,
      published       INTEGER DEFAULT 0,
      telegram_sent   INTEGER DEFAULT 0,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS training_day_registrations (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      training_day_id INTEGER NOT NULL REFERENCES training_days(id) ON DELETE CASCADE,
      student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      activity_type   TEXT,
      confirmed_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(training_day_id, student_id)
    );
    CREATE TABLE IF NOT EXISTS flight_media (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_id  INTEGER NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
      student_id INTEGER REFERENCES students(id),
      type       TEXT DEFAULT 'photo',
      r2_key     TEXT,
      url        TEXT,
      caption    TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
      type       TEXT,
      title      TEXT,
      message    TEXT,
      action_url TEXT,
      read       INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      category     TEXT NOT NULL,
      phase        TEXT DEFAULT 'p1',
      question_fr  TEXT NOT NULL,
      question_en  TEXT,
      opt_a_fr     TEXT, opt_b_fr TEXT, opt_c_fr TEXT, opt_d_fr TEXT,
      opt_a_en     TEXT, opt_b_en TEXT, opt_c_en TEXT, opt_d_en TEXT,
      correct      TEXT NOT NULL,
      explain_fr   TEXT,
      explain_en   TEXT
    );
    CREATE TABLE IF NOT EXISTS training_sessions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      instructor_id INTEGER REFERENCES instructors(id),
      date          DATE DEFAULT (date('now')),
      notes         TEXT,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS session_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  INTEGER REFERENCES training_sessions(id) ON DELETE CASCADE,
      student_id  INTEGER REFERENCES students(id) ON DELETE CASCADE,
      exercise_id INTEGER REFERENCES exercises(id),
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENTS
// ─────────────────────────────────────────────────────────────────────────────
export function getPayments(studentId) {
  return getDb().prepare('SELECT * FROM payments WHERE student_id=? ORDER BY date DESC').all(studentId);
}
export function addPayment({ student_id, amount, date, method, notes, status }) {
  // Default 'pending' — instructor must approve before it counts as 'paid'
  return getDb().prepare('INSERT INTO payments (student_id,amount,date,method,notes,status) VALUES (?,?,?,?,?,?)')
    .run(student_id, amount, date||new Date().toISOString().slice(0,10), method||'interac', notes||'', status||'pending').lastInsertRowid;
}
export function approvePayment(id) {
  getDb().prepare("UPDATE payments SET status='paid' WHERE id=?").run(id);
}
export function rejectPayment(id) {
  getDb().prepare("UPDATE payments SET status='rejected' WHERE id=?").run(id);
}
export function getAllPendingPayments() {
  return getDb().prepare(`
    SELECT p.*, s.name as student_name
    FROM payments p JOIN students s ON s.id=p.student_id
    WHERE p.status='pending' ORDER BY p.created_at DESC
  `).all();
}
export function deletePayment(id) { getDb().prepare('DELETE FROM payments WHERE id=?').run(id); }
export function getPaymentSummary(studentId) {
  const rows = getDb().prepare("SELECT SUM(amount) as total FROM payments WHERE student_id=? AND status='paid'").get(studentId);
  return rows?.total || 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAINING DAYS (planning)
// ─────────────────────────────────────────────────────────────────────────────
export function getTrainingDays(limit=14) {
  return getDb().prepare("SELECT td.*, COUNT(r.id) as reg_count FROM training_days td LEFT JOIN training_day_registrations r ON r.training_day_id=td.id GROUP BY td.id ORDER BY td.date DESC LIMIT ?").all(limit);
}
export function getTrainingDay(id) {
  const td = getDb().prepare('SELECT * FROM training_days WHERE id=?').get(id);
  if (!td) return null;
  td.registrations = getDb().prepare('SELECT r.*, s.name as student_name FROM training_day_registrations r JOIN students s ON s.id=r.student_id WHERE r.training_day_id=?').all(id);
  return td;
}
export function getUpcomingTrainingDays(studentId = null) {
  const db = getDb();
  const days = db.prepare(`
    SELECT td.*, COUNT(r.id) as reg_count
    FROM training_days td
    LEFT JOIN training_day_registrations r ON r.training_day_id=td.id
    WHERE td.date >= date('now') AND td.published=1
    GROUP BY td.id ORDER BY td.date ASC LIMIT 5
  `).all();
  for (const day of days) {
    day.registrations = db.prepare(`
      SELECT r.student_id, r.activity_type, r.confirmed_at, s.name as student_name
      FROM training_day_registrations r
      JOIN students s ON s.id=r.student_id
      WHERE r.training_day_id=? ORDER BY r.confirmed_at ASC
    `).all(day.id);
    day.student_registered = studentId
      ? !!db.prepare('SELECT id FROM training_day_registrations WHERE training_day_id=? AND student_id=?').get(day.id, studentId)
      : false;
  }
  return days;
}
export function createTrainingDay(d) {
  return getDb().prepare('INSERT INTO training_days (date,instructor_id,activity_types,launch_site,max_students,weather_summary,plan_text,wind_min,wind_max,wind_dir) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(d.date,d.instructor_id,d.activity_types||'[]',d.launch_site||'',d.max_students||12,d.weather_summary||'',d.plan_text||'',d.wind_min||null,d.wind_max||null,d.wind_dir||'').lastInsertRowid;
}
export function publishTrainingDay(id) {
  getDb().prepare("UPDATE training_days SET published=1 WHERE id=?").run(id);
}
export function markTelegramSent(id) {
  getDb().prepare("UPDATE training_days SET telegram_sent=1 WHERE id=?").run(id);
}
export function registerForTrainingDay(training_day_id, student_id, activity_type) {
  try {
    getDb().prepare('INSERT OR REPLACE INTO training_day_registrations (training_day_id,student_id,activity_type) VALUES (?,?,?)').run(training_day_id, student_id, activity_type||'flight');
    return true;
  } catch { return false; }
}
export function unregisterFromTrainingDay(training_day_id, student_id) {
  getDb().prepare('DELETE FROM training_day_registrations WHERE training_day_id=? AND student_id=?').run(training_day_id, student_id);
}
// ── SESSION ROSTER ─────────────────────────────────────────────────────────
export function getTodayRoster(date) {
  const d = date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  try {
    return getDb().prepare(`
      SELECT r.*, s.name as student_name, s.id as student_id,
        e.wing_color_1, COALESCE(e.wing_le_color, e.wing_color_2) as wing_le_color,
        e.harness_color,
        CAST((julianday('now') - julianday(COALESCE(r.last_heartbeat, r.created_at))) * 86400 AS INTEGER) as heartbeat_age_s,
        (SELECT COUNT(*) FROM flights f WHERE f.student_id=r.student_id
          AND f.date=? AND f.status='complete') as flights_today
      FROM session_roster r
      JOIN students s ON s.id=r.student_id
      LEFT JOIN student_equipment e ON e.student_id=r.student_id
      WHERE r.session_date=?
      ORDER BY CASE r.status WHEN 'flying' THEN 0 WHEN 'ground' THEN 1 ELSE 2 END, s.name
    `).all(d, d);
  } catch(e) { return []; }
}
export function addToRoster(studentId, date) {
  const d   = date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  const db  = getDb();
  const now = new Date().toISOString();
  try {
    const ex = db.prepare('SELECT id FROM session_roster WHERE student_id=? AND session_date=?').get(studentId, d);
    if (!ex) {
      db.prepare(`INSERT INTO session_roster (student_id, session_date, status, created_at) VALUES (?,?,'ground',?)`).run(studentId, d, now);
    }
  } catch(e) {}
}

export function getTodayFlightsWithStatus(date) {
  // Returns all students with active flights today (from flights table)
  // Joined with their live roster status — roster is OPTIONAL, not required
  const eastern = date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  const utcDate = new Date().toISOString().slice(0, 10);
  const db = getDb();
  try {
    return db.prepare(`
      SELECT
        s.id            AS student_id,
        s.name          AS student_name,
        COALESCE(e.wing_color_1, '#3b82f6')                        AS wing_color_1,
        COALESCE(e.wing_le_color, e.wing_color_2, '#e2e8f0')       AS wing_le_color,
        COALESCE(e.harness_color, '#1e293b')                       AS harness_color,
        COALESCE(r.status, 'ground')                               AS status,
        r.launched_at,
        r.landed_at,
        r.last_heartbeat,
        CAST(
          (julianday('now') - julianday(COALESCE(r.last_heartbeat,'2000-01-01')))
          * 86400 AS INTEGER
        ) AS heartbeat_age_s,
        f.id   AS flight_id,
        f.date AS flight_date
      FROM students s
      INNER JOIN flights f ON f.student_id = s.id
        AND f.status IN ('preflight','active')
        AND f.date IN (?, ?, date('now'), date('now','-1 day'))
      LEFT JOIN session_roster r ON r.student_id = s.id
        AND r.session_date IN (?, ?, date('now'), date('now','-1 day'))
      LEFT JOIN student_equipment e ON e.student_id = s.id
      GROUP BY s.id
      ORDER BY
        CASE COALESCE(r.status,'ground')
          WHEN 'flying' THEN 0
          WHEN 'ground' THEN 1
          ELSE 2
        END,
        s.name
    `).all(eastern, utcDate, eastern, utcDate);
  } catch(e) { console.error('[getTodayFlightsWithStatus]', e.message); return []; }
}

export function autoPopulateFromTodayFlights(date) {
  // Automatically add all students with flights today to the roster
  // So they appear on instructor dashboard without needing GPS signal
  const d = date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  const db = getDb();
  try {
    const flights = db.prepare(
      "SELECT DISTINCT student_id FROM flights WHERE date=? AND status IN ('preflight','active','complete')"
    ).all(d);
    for (const { student_id } of flights) {
      addToRoster(student_id, d);
    }
  } catch(e) {}
}

export function removeFromRoster(studentId, date) {
  const d = date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  try { getDb().prepare('DELETE FROM session_roster WHERE student_id=? AND session_date=?').run(studentId, d); } catch(e) {}
}
export function updateRosterStatus(studentId, date, status, source='manual') {
  const d   = date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  const now = new Date().toISOString();
  const db  = getDb();
  try {
    // Auto-create entry if missing
    const entry = db.prepare('SELECT * FROM session_roster WHERE student_id=? AND session_date=?').get(studentId, d);
    if (!entry) {
      db.prepare(`INSERT INTO session_roster (student_id, session_date, status, created_at) VALUES (?,?,'ground',?)`).run(studentId, d, now);
    }
    if (status === 'flying') {
      getDb().prepare('UPDATE session_roster SET status=?,launched_at=?,source=? WHERE student_id=? AND session_date=?').run(status, now, source, studentId, d);
    } else if (status === 'landed') {
      getDb().prepare('UPDATE session_roster SET status=?,landed_at=?,source=? WHERE student_id=? AND session_date=?').run(status, now, source, studentId, d);
    } else {
      getDb().prepare('UPDATE session_roster SET status=?,source=? WHERE student_id=? AND session_date=?').run(status, source, studentId, d);
    }
  } catch(e) { console.error('updateRosterStatus:', e.message); }
}
export function getStudentRosterStatus(studentId, date) {
  const d = date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  try { return getDb().prepare('SELECT * FROM session_roster WHERE student_id=? AND session_date=?').get(studentId, d); } catch(e) { return null; }
}
export function autoUpdateRosterFromFlights(date) {
  // ONLY auto-land: if a flight was marked complete but GPS didn't signal landing
  const d = date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  try {
    const db = getDb();
    const roster = db.prepare("SELECT * FROM session_roster WHERE session_date=? AND status='flying'").all(d);
    for (const entry of roster) {
      const flight = db.prepare(
        "SELECT status FROM flights WHERE student_id=? AND date=? ORDER BY created_at DESC LIMIT 1"
      ).get(entry.student_id, d);
      // Only auto-land if flight record is marked complete
      if (flight?.status === 'complete') {
        db.prepare(
          "UPDATE session_roster SET status='landed', landed_at=COALESCE(landed_at,datetime('now')), source='auto' WHERE student_id=? AND session_date=?"
        ).run(entry.student_id, d);
      }
    }
  } catch(e) {}
}

export function completeAppReset() {
  const db = getDb();
  const tx = db.transaction(() => {
    // Log the reset first (survives the reset)
    try { db.prepare("CREATE TABLE IF NOT EXISTS reset_log (id INTEGER PRIMARY KEY AUTOINCREMENT, reset_at DATETIME DEFAULT CURRENT_TIMESTAMP, note TEXT)").run(); } catch(e) {}
    try { db.prepare("INSERT INTO reset_log (note) VALUES ('Complete app reset')").run(); } catch(e) {}

    // Delete ALL student data
    const tables = [
      'exercise_logs','exam_attempts','theory_progress','flight_media',
      'flight_debriefings','training_registrations','message_reads',
      'student_message_dismissals','student_orders','student_bills',
      'student_payments','student_sessions','student_orders',
      'payments', 'flight_logs',
    ];
    for (const t of tables) {
      try { db.prepare(`DELETE FROM ${t}`).run(); } catch(e) {}
    }
    // Delete flights
    try { db.prepare("DELETE FROM flights").run(); } catch(e) {}
    // Delete students
    try { db.prepare("DELETE FROM students").run(); } catch(e) {}
    // Delete messages (instructor → students)
    try { db.prepare("DELETE FROM messages").run(); } catch(e) {}
    // Delete training days / planning
    try { db.prepare("DELETE FROM training_days").run(); } catch(e) {}
    // Delete site photos
    try { db.prepare("DELETE FROM site_photos").run(); } catch(e) {}
    // Delete instructor sessions (force re-login after reset)
    // Keep instructor accounts but clear sessions
    // DO NOT delete: library_items, quiz_questions, exercises, theory_blocks, exams, instructors
    console.log('[db] Complete app reset executed');
  });
  tx();
}

export function resetStudentData(studentId) {
  const db = getDb();
  const tables = [
    'exercise_logs','exam_attempts','theory_progress','quiz_results',
    'flight_media','flights','training_day_registrations',
    'student_message_dismissals','student_orders','student_bills','student_payments',
  ];
  for (const t of tables) {
    try { db.prepare(`DELETE FROM ${t} WHERE student_id=?`).run(studentId); }
    catch(e) { console.warn(`[reset] skip ${t}:`, e.message); }
  }
  try { db.prepare("UPDATE students SET profile_picture_url=NULL WHERE id=?").run(studentId); }
  catch(e) {}
  console.log(`[db] Student ${studentId} data reset to zero`);
}

export function updateTrainingDay(id, d) {
  getDb().prepare('UPDATE training_days SET date=?,launch_site=?,activity_types=?,max_students=?,weather_summary=?,plan_text=?,wind_min=?,wind_max=?,wind_dir=? WHERE id=?')
    .run(d.date,d.launch_site||'',d.activity_types||'[]',d.max_students||12,d.weather_summary||'',d.plan_text||'',d.wind_min||null,d.wind_max||null,d.wind_dir||'',id);
}
export function deleteTrainingDay(id) {
  // Cascade deletes registrations automatically (ON DELETE CASCADE)
  getDb().prepare('DELETE FROM training_days WHERE id=?').run(id);
}
export function getTrainingDayRegistrations(training_day_id) {
  return getDb().prepare(`
    SELECT r.*, s.name as student_name, s.profile_picture_url
    FROM training_day_registrations r
    JOIN students s ON s.id = r.student_id
    WHERE r.training_day_id = ?
    ORDER BY r.confirmed_at ASC
  `).all(training_day_id);
}
export function getStudentRegistration(training_day_id, student_id) {
  return getDb().prepare('SELECT * FROM training_day_registrations WHERE training_day_id=? AND student_id=?').get(training_day_id, student_id);
}

// ─────────────────────────────────────────────────────────────────────────────
// FLIGHT MEDIA
// ─────────────────────────────────────────────────────────────────────────────
export function getFlightMedia(flightId) {
  return getDb().prepare('SELECT * FROM flight_media WHERE flight_id=? ORDER BY uploaded_at ASC').all(flightId);
}
export function addFlightMedia({ flight_id, student_id, type, r2_key, url, caption }) {
  return getDb().prepare('INSERT INTO flight_media (flight_id,student_id,type,r2_key,url,caption) VALUES (?,?,?,?,?,?)')
    .run(flight_id, student_id||null, type||'photo', r2_key||'', url||'', caption||'').lastInsertRowid;
}
export function deleteFlightMedia(id, studentId) {
  const m = getDb().prepare('SELECT * FROM flight_media WHERE id=?').get(id);
  if (!m) return false;
  if (studentId && m.student_id !== studentId) return false;
  getDb().prepare('DELETE FROM flight_media WHERE id=?').run(id);
  return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────
export function getNotifications(studentId, unreadOnly=false) {
  const q = unreadOnly
    ? "SELECT * FROM notifications WHERE student_id=? AND read=0 ORDER BY created_at DESC LIMIT 20"
    : "SELECT * FROM notifications WHERE student_id=? ORDER BY created_at DESC LIMIT 30";
  return getDb().prepare(q).all(studentId);
}
export function createNotification({ student_id, type, title, message, action_url }) {
  return getDb().prepare('INSERT INTO notifications (student_id,type,title,message,action_url) VALUES (?,?,?,?,?)')
    .run(student_id, type||'info', title||'', message||'', action_url||'').lastInsertRowid;
}
export function markNotificationsRead(studentId) {
  getDb().prepare('UPDATE notifications SET read=1 WHERE student_id=?').run(studentId);
}
export function notifyAllStudents(type, title, message, action_url='') {
  const db = getDb();
  const students = db.prepare('SELECT id FROM students WHERE active=1').all();
  for (const s of students) {
    db.prepare('INSERT INTO notifications (student_id,type,title,message,action_url) VALUES (?,?,?,?,?)')
      .run(s.id, type, title, message, action_url);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUIZ
// ─────────────────────────────────────────────────────────────────────────────
export function getQuizQuestions(category=null, phase=null, limit=20) {
  let q = 'SELECT * FROM quiz_questions';
  const params = [];
  const where = [];
  if (category) { where.push('category=?'); params.push(category); }
  if (phase)    { where.push('phase=?');    params.push(phase); }
  if (where.length) q += ' WHERE ' + where.join(' AND ');
  q += ' ORDER BY RANDOM() LIMIT ?';
  params.push(limit);
  return getDb().prepare(q).all(...params);
}
export function getQuizCategories() {
  return getDb().prepare('SELECT DISTINCT category, phase FROM quiz_questions ORDER BY phase, category').all();
}
export function quizQuestionCount() {
  return getDb().prepare('SELECT COUNT(*) as n FROM quiz_questions').get()?.n || 0;
}
export function getAllQuizQuestions() {
  return getDb().prepare('SELECT * FROM quiz_questions ORDER BY phase, category, id').all();
}
export function createQuizQuestion({ question_fr, question_en, opt_a_fr, opt_b_fr, opt_c_fr, opt_d_fr, correct, explain_fr, phase, category }) {
  return getDb().prepare(
    'INSERT INTO quiz_questions (category, phase, question_fr, question_en, opt_a_fr, opt_b_fr, opt_c_fr, opt_d_fr, correct, explain_fr) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(category||'general', phase||'p1', question_fr||'', question_en||null, opt_a_fr||null, opt_b_fr||null, opt_c_fr||null, opt_d_fr||null, correct||'a', explain_fr||null).lastInsertRowid;
}
export function updateQuizQuestion(id, { question_fr, question_en, opt_a_fr, opt_b_fr, opt_c_fr, opt_d_fr, correct, explain_fr, phase, category }) {
  getDb().prepare(
    'UPDATE quiz_questions SET category=?, phase=?, question_fr=?, question_en=?, opt_a_fr=?, opt_b_fr=?, opt_c_fr=?, opt_d_fr=?, correct=?, explain_fr=? WHERE id=?'
  ).run(category||'general', phase||'p1', question_fr||'', question_en||null, opt_a_fr||null, opt_b_fr||null, opt_c_fr||null, opt_d_fr||null, correct||'a', explain_fr||null, id);
}
export function deleteQuizQuestion(id) {
  getDb().prepare('DELETE FROM quiz_questions WHERE id=?').run(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAINING SESSIONS (instructor session mode)
// ─────────────────────────────────────────────────────────────────────────────
export function createTrainingSession({ instructor_id, date, notes }) {
  return getDb().prepare('INSERT INTO training_sessions (instructor_id,date,notes) VALUES (?,?,?)')
    .run(instructor_id, date||new Date().toISOString().slice(0,10), notes||'').lastInsertRowid;
}
export function logSessionExercise({ session_id, student_id, exercise_id }) {
  return getDb().prepare('INSERT INTO session_logs (session_id,student_id,exercise_id) VALUES (?,?,?)')
    .run(session_id, student_id, exercise_id).lastInsertRowid;
}
export function bulkSignOffSession(sessionId, instructorId) {
  const db = getDb();
  const logs = db.prepare('SELECT * FROM session_logs WHERE session_id=?').all(sessionId);
  const today = new Date().toISOString().slice(0,10);
  for (const log of logs) {
    const existing = db.prepare("SELECT id FROM exercise_logs WHERE student_id=? AND exercise_id=? AND status='passed'").get(log.student_id, log.exercise_id);
    if (!existing) {
      const elId = db.prepare("INSERT OR IGNORE INTO exercise_logs (student_id,exercise_id,date,status,signed_off_by,signed_off_at,instructor_notes) VALUES (?,?,?,'passed',?,datetime('now'),'Session sign-off')")
        .run(log.student_id, log.exercise_id, today, instructorId).lastInsertRowid;
    }
  }
  return logs.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT READINESS FLAGS
// ─────────────────────────────────────────────────────────────────────────────
export function getStudentReadiness(studentId) {
  const db = getDb();
  const passed = (status) => db.prepare(`SELECT COUNT(*) as n FROM exercise_logs WHERE student_id=? AND status=?`).get(studentId, status).n;
  const examPassed = (phase) => db.prepare(`SELECT COUNT(*) as n FROM exam_attempts ea JOIN exam_defs ed ON ed.id=ea.exam_id WHERE ea.student_id=? AND ea.passed=1 AND ea.signed_off_at IS NOT NULL AND ed.phase=?`).get(studentId, phase).n;
  const theoryDone = (phase) => db.prepare(`SELECT COUNT(*) as n FROM theory_progress tp JOIN theory_blocks tb ON tb.id=tp.block_id WHERE tp.student_id=? AND tp.completed=1 AND tb.phase=?`).get(studentId, phase).n;
  const theoryTotal = (phase) => db.prepare('SELECT COUNT(*) as n FROM theory_blocks WHERE phase=?').get(phase).n;
  const flightCount = db.prepare("SELECT COUNT(*) as n FROM flights WHERE student_id=? AND status='complete'").get(studentId).n;
  const ghPassed = db.prepare("SELECT COUNT(DISTINCT el.exercise_id) as n FROM exercise_logs el JOIN exercises ex ON ex.id=el.exercise_id WHERE el.student_id=? AND el.status='passed' AND ex.category='ground_handling'").get(studentId).n;
  const ghTotal  = db.prepare("SELECT COUNT(*) as n FROM exercises WHERE category='ground_handling'").get().n;
  const airPassed= db.prepare("SELECT COUNT(DISTINCT el.exercise_id) as n FROM exercise_logs el JOIN exercises ex ON ex.id=el.exercise_id WHERE el.student_id=? AND el.status='passed' AND ex.category='airborne'").get(studentId).n;
  const airTotal = db.prepare("SELECT COUNT(*) as n FROM exercises WHERE category='airborne'").get().n;
  const p1ExamsPassed = examPassed('p1');
  const p1TheoryDone  = theoryDone('p1');
  const p1TheoryTotal = theoryTotal('p1');
  const p2ExamsPassed = examPassed('p2');
  return {
    readyForFirstFlight: ghPassed >= Math.min(5, ghTotal) && p1TheoryDone >= Math.min(3, p1TheoryTotal) && flightCount === 0,
    readyForP1Signoff:   ghPassed >= ghTotal && airPassed >= Math.floor(airTotal*0.8) && p1ExamsPassed >= 1 && p1TheoryDone >= p1TheoryTotal,
    readyForP2Start:     p1ExamsPassed >= 1 && flightCount >= 10,
    readyForP2Signoff:   p2ExamsPassed >= 1 && flightCount >= 25,
    flightCount, ghPassed, ghTotal, airPassed, airTotal,
    p1ExamsPassed, p1TheoryDone, p1TheoryTotal,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────
export function getAnalytics() {
  const db = getDb();
  const exerciseStats = db.prepare(`
    SELECT ex.title, ex.title_fr, ex.category,
           COUNT(el.id) as attempts,
           SUM(CASE WHEN el.status='passed' THEN 1 ELSE 0 END) as passed,
           SUM(CASE WHEN el.status='pending' THEN 1 ELSE 0 END) as pending
    FROM exercises ex
    LEFT JOIN exercise_logs el ON el.exercise_id=ex.id
    GROUP BY ex.id ORDER BY attempts DESC
  `).all();
  const theoryStats = db.prepare(`
    SELECT tb.title, tb.title_fr,
           COUNT(tp.id) as completed_count,
           (SELECT COUNT(*) FROM students WHERE active=1) as total_students
    FROM theory_blocks tb
    LEFT JOIN theory_progress tp ON tp.block_id=tb.id AND tp.completed=1
    GROUP BY tb.id ORDER BY completed_count ASC
  `).all();
  const flightStats = db.prepare(`
    SELECT COUNT(*) as total, AVG(duration_seconds) as avg_dur,
           AVG(confidence_rating) as avg_confidence
    FROM flights WHERE status='complete'
  `).get();
  const studentCount = db.prepare('SELECT COUNT(*) as n FROM students WHERE active=1').get().n;
  return { exerciseStats, theoryStats, flightStats, studentCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT CONTACT UPDATE
// ─────────────────────────────────────────────────────────────────────────────
export function updateStudentContact(id, { phone, email, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship }) {
  getDb().prepare('UPDATE students SET phone=?, email=?, emergency_contact_name=?, emergency_contact_phone=?, emergency_contact_relationship=? WHERE id=?')
    .run(phone||'', email||'', emergency_contact_name||'', emergency_contact_phone||'', emergency_contact_relationship||'', id);
}
export function updateEquipmentDates(studentId, { reserve_repack_date, harness_inspection_date, glider_inspection_date, glider_hours }) {
  const db = getDb();
  const eq = db.prepare('SELECT id FROM student_equipment WHERE student_id=?').get(studentId);
  if (eq) {
    db.prepare('UPDATE student_equipment SET reserve_repack_date=?, harness_inspection_date=?, glider_inspection_date=?, glider_hours=? WHERE student_id=?')
      .run(reserve_repack_date||null, harness_inspection_date||null, glider_inspection_date||null, glider_hours||null, studentId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEDUPLICATE EXERCISES — one-time migration
// Keeps the lowest-ID entry per (title, category), re-points logs to it,
// deletes the orphan rows.
// ─────────────────────────────────────────────────────────────────────────────
export function deduplicateExercises(db) {
  // Find groups with more than one row sharing the same title+category
  const dupes = db.prepare(`
    SELECT MIN(id) as keep_id, title, title_fr, category, COUNT(*) as cnt
    FROM exercises
    GROUP BY LOWER(COALESCE(title_fr, title)), category
    HAVING cnt > 1
  `).all();

  if (!dupes.length) return 0;

  let removed = 0;
  for (const row of dupes) {
    // All IDs in this group
    const members = db.prepare(`
      SELECT id FROM exercises
      WHERE LOWER(COALESCE(title_fr, title)) = LOWER(COALESCE(?, ?))
        AND category = ?
      ORDER BY id ASC
    `).all(row.title_fr, row.title, row.category);

    const keepId   = members[0].id;
    const dropIds  = members.slice(1).map(m => m.id);

    for (const dropId of dropIds) {
      // Re-point any exercise_logs that reference the duplicate
      db.prepare(`
        UPDATE OR IGNORE exercise_logs SET exercise_id = ? WHERE exercise_id = ?
      `).run(keepId, dropId);
      // Delete logs that now conflict (same student+exercise already exists with kept id)
      db.prepare(`
        DELETE FROM exercise_logs WHERE exercise_id = ? AND id NOT IN (
          SELECT MIN(id) FROM exercise_logs WHERE exercise_id = ? GROUP BY student_id
        )
      `).run(dropId, dropId);
      // Delete the duplicate exercise definition
      db.prepare(`DELETE FROM exercises WHERE id = ?`).run(dropId);
      removed++;
    }
  }
  return removed;
}

// ─────────────────────────────────────────────────────────────────────────────
// V47 MIGRATIONS — messages, orders, bills, payment proofs, site photos
// ─────────────────────────────────────────────────────────────────────────────
export function runV47Migrations(db) {
  // Add profile picture to students
  const scols = db.pragma('table_info(students)').map(c=>c.name);
  if (!scols.includes('profile_picture_url')) {
    db.exec('ALTER TABLE students ADD COLUMN profile_picture_url TEXT');
  }

  // Remove Pre-Solo simulator exercises — these are not standalone curriculum items.
  // They inflate the exercise count incorrectly (should be 10 pre-flight + 8 launch = 18 GH).
  // CASCADE delete also removes any exercise_logs for these items.
  const presoloIds = db.prepare(
    "SELECT id FROM exercises WHERE title LIKE 'Pre-Solo%' OR title LIKE 'PS-%'"
  ).all().map(r => r.id);
  if (presoloIds.length > 0) {
    // Re-point logs to null first (exercise_logs uses ON DELETE CASCADE so just delete)
    db.prepare(
      `DELETE FROM exercises WHERE title LIKE 'Pre-Solo%' OR title LIKE 'PS-%'`
    ).run();
    console.log(`[db] Removed ${presoloIds.length} Pre-Solo exercises (not curriculum items)`);
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS student_messages (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT NOT NULL,
      body         TEXT NOT NULL,
      created_by   INTEGER REFERENCES instructors(id),
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS student_message_dismissals (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL REFERENCES student_messages(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      dismissed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, student_id)
    );
    CREATE TABLE IF NOT EXISTS student_orders (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      description  TEXT NOT NULL,
      status       TEXT DEFAULT 'pending',
      instructor_response TEXT,
      responded_at DATETIME,
      confirmed_at DATETIME,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS order_messages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id    INTEGER NOT NULL REFERENCES student_orders(id) ON DELETE CASCADE,
      sender_type TEXT NOT NULL,            -- 'student' | 'instructor'
      sender_id   INTEGER,
      body        TEXT NOT NULL,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS waiver_documents (
      slot       INTEGER PRIMARY KEY,        -- 1, 2, 3
      title      TEXT,
      file_url   TEXT,                       -- /api/file?key=... of the blank template PDF
      recipients TEXT DEFAULT 'school',      -- 'school' | 'school_club'
      version    INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS waiver_signatures (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id     INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      slot           INTEGER NOT NULL,
      waiver_version INTEGER DEFAULT 1,
      signed_name    TEXT NOT NULL,
      signature_url  TEXT,                   -- PNG of the drawn signature
      signed_pdf_url TEXT,                   -- generated signed PDF (template + signature page)
      emailed_at     DATETIME,
      signed_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS session_roster (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_date TEXT NOT NULL,
      student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      status       TEXT DEFAULT 'ground',
      launched_at  DATETIME,
      landed_at    DATETIME,
      last_heartbeat DATETIME,
      source       TEXT DEFAULT 'manual',
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    -- migration: add last_heartbeat if missing
    CREATE INDEX IF NOT EXISTS idx_roster_date ON session_roster(session_date);
    CREATE TABLE IF NOT EXISTS flight_removal_requests (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_id     INTEGER NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
      student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      reason        TEXT,
      status        TEXT NOT NULL DEFAULT 'pending',
      requested_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at  DATETIME,
      processed_by  INTEGER REFERENCES instructors(id)
    );
        CREATE TABLE IF NOT EXISTS student_bills (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      title           TEXT NOT NULL,
      filename        TEXT NOT NULL,
      r2_key          TEXT,
      url             TEXT,
      uploaded_by     INTEGER REFERENCES instructors(id),
      uploader_type   TEXT DEFAULT 'instructor',
      notes           TEXT,
      uploaded_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS payment_proofs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
      filename   TEXT,
      r2_key     TEXT,
      url        TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS site_photos (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      site_key    TEXT NOT NULL,
      site_type   TEXT NOT NULL DEFAULT 'launch',
      filename    TEXT,
      r2_key      TEXT,
      url         TEXT,
      uploaded_by INTEGER REFERENCES instructors(id),
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(site_key, site_type)
    );
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────────────────────────────────────
export function getMessages() {
  return getDb().prepare('SELECT m.*, i.name as instructor_name FROM student_messages m LEFT JOIN instructors i ON i.id=m.created_by ORDER BY m.created_at DESC').all();
}
export function createMessage({ title, body, instructor_id }) {
  return getDb().prepare('INSERT INTO student_messages (title,body,created_by) VALUES (?,?,?)').run(title, body, instructor_id).lastInsertRowid;
}
export function deleteMessage(id) {
  getDb().prepare('DELETE FROM student_messages WHERE id=?').run(id);
}
export function getMessagesForStudent(studentId) {
  return getDb().prepare(`
    SELECT m.*, i.name as instructor_name,
           d.dismissed_at
    FROM student_messages m
    LEFT JOIN instructors i ON i.id=m.created_by
    LEFT JOIN student_message_dismissals d ON d.message_id=m.id AND d.student_id=?
    ORDER BY m.created_at DESC
  `).all(studentId);
}
export function dismissMessage(messageId, studentId) {
  getDb().prepare('INSERT OR IGNORE INTO student_message_dismissals (message_id,student_id) VALUES (?,?)').run(messageId, studentId);
}
export function restoreMessage(messageId, studentId) {
  getDb().prepare('DELETE FROM student_message_dismissals WHERE message_id=? AND student_id=?').run(messageId, studentId);
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────────────────────────────────────
export function getNewOrdersForInstructor() {
  // Orders submitted by students that the instructor hasn't seen yet
  try {
    return getDb().prepare(`
      SELECT o.*, s.name as student_name
      FROM student_orders o JOIN students s ON s.id=o.student_id
      WHERE o.instructor_seen=0 AND o.status='pending'
      ORDER BY o.created_at DESC
    `).all();
  } catch(e) { return []; }
}
export function markOrdersSeenByInstructor(ids) {
  if (!ids?.length) return;
  try {
    const stmt = getDb().prepare('UPDATE student_orders SET instructor_seen=1 WHERE id=?');
    for (const id of ids) stmt.run(id);
  } catch(e) {}
}
export function getOrdersForStudent(studentId) {
  return getDb().prepare('SELECT * FROM student_orders WHERE student_id=? ORDER BY created_at DESC').all(studentId);
}
export function getAllOrders() {
  return getDb().prepare(`
    SELECT o.*, s.name as student_name
    FROM student_orders o
    JOIN students s ON s.id=o.student_id
    ORDER BY o.created_at DESC
  `).all();
}
export function createOrder(studentId, description) {
  const id = getDb().prepare('INSERT INTO student_orders (student_id,description) VALUES (?,?)').run(studentId, description).lastInsertRowid;
  // Seed the conversation thread with the student's opening request
  try { addOrderMessage(id, 'student', studentId, description); } catch(e) {}
  return id;
}
export function respondToOrder(id, response, instructorId) {
  // Legacy single-response path — also records the reply in the thread
  getDb().prepare(`UPDATE student_orders SET instructor_response=?, responded_at=datetime('now'), status='responded' WHERE id=?`).run(response, id);
  try { addOrderMessage(id, 'instructor', instructorId, response); } catch(e) {}
}
export function confirmOrder(id) {
  getDb().prepare(`UPDATE student_orders SET confirmed_at=datetime('now'), status='confirmed' WHERE id=?`).run(id);
}
export function deleteOrder(id) {
  getDb().prepare('DELETE FROM student_orders WHERE id=?').run(id);
}

// ── Order chat thread ───────────────────────────────────────
// Either party can post repeatedly until the instructor confirms.
export function addOrderMessage(orderId, senderType, senderId, body) {
  const db = getDb();
  db.prepare(`INSERT INTO order_messages (order_id, sender_type, sender_id, body) VALUES (?,?,?,?)`)
    .run(orderId, senderType, senderId || null, String(body));
  // Move the order's status/flags so it resurfaces for whoever now owes a reply.
  if (senderType === 'student') {
    // student posted -> instructor needs to see it again
    try { db.prepare(`UPDATE student_orders SET instructor_seen=0, status=CASE WHEN status='confirmed' THEN status ELSE 'pending' END WHERE id=?`).run(orderId); }
    catch(e) { db.prepare(`UPDATE student_orders SET status=CASE WHEN status='confirmed' THEN status ELSE 'pending' END WHERE id=?`).run(orderId); }
  } else {
    db.prepare(`UPDATE student_orders SET responded_at=datetime('now'), status=CASE WHEN status='confirmed' THEN status ELSE 'responded' END WHERE id=?`).run(orderId);
  }
}
export function getOrderMessages(orderId) {
  return getDb().prepare(`SELECT * FROM order_messages WHERE order_id=? ORDER BY created_at ASC, id ASC`).all(orderId);
}
// Full order + thread. Back-fills a synthetic thread from the legacy
// description / instructor_response columns for orders created before chat existed.
export function getOrderWithThread(orderId) {
  const db = getDb();
  const order = db.prepare(`
    SELECT o.*, s.name as student_name
    FROM student_orders o JOIN students s ON s.id=o.student_id
    WHERE o.id=?`).get(orderId);
  if (!order) return null;
  let msgs = getOrderMessages(orderId);
  if (!msgs.length) {
    msgs = [];
    if (order.description)         msgs.push({ id:'legacy-d', order_id:orderId, sender_type:'student',    sender_id:order.student_id, body:order.description,         created_at:order.created_at });
    if (order.instructor_response) msgs.push({ id:'legacy-r', order_id:orderId, sender_type:'instructor', sender_id:null,             body:order.instructor_response, created_at:order.responded_at });
  }
  order.messages = msgs;
  return order;
}

// ── App settings (key/value) ────────────────────────────────
export function getSetting(key, fallback = '') {
  try { const r = getDb().prepare('SELECT value FROM app_settings WHERE key=?').get(key); return r ? r.value : fallback; }
  catch(e) { return fallback; }
}
export function setSetting(key, value) {
  getDb().prepare('INSERT INTO app_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value ?? ''));
}

// ── Waivers ─────────────────────────────────────────────────
export function getWaiverDocuments() {
  const rows = getDb().prepare('SELECT * FROM waiver_documents ORDER BY slot').all();
  const bySlot = Object.fromEntries(rows.map(r => [r.slot, r]));
  // Always return 3 slots so the instructor UI has placeholders
  return [1,2,3].map(slot => bySlot[slot] || { slot, title:'', file_url:null, recipients: slot===3?'school_club':'school', version:0 });
}
export function getActiveWaivers() {
  // Only waivers that actually have a PDF uploaded count toward the gate
  return getWaiverDocuments().filter(w => w.file_url);
}
export function upsertWaiverDocument(slot, { title, file_url, recipients }) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM waiver_documents WHERE slot=?').get(slot);
  if (existing) {
    // bump version only when the file actually changes (forces re-signing)
    const newVersion = (file_url && file_url !== existing.file_url) ? (existing.version || 1) + 1 : (existing.version || 1);
    db.prepare(`UPDATE waiver_documents SET title=?, file_url=COALESCE(?,file_url), recipients=?, version=?, updated_at=datetime('now') WHERE slot=?`)
      .run(title ?? existing.title, file_url || null, recipients || existing.recipients, newVersion, slot);
  } else {
    db.prepare(`INSERT INTO waiver_documents (slot,title,file_url,recipients,version) VALUES (?,?,?,?,1)`)
      .run(slot, title || '', file_url || null, recipients || (slot===3?'school_club':'school'));
  }
}
export function getStudentWaiverSignatures(studentId) {
  return getDb().prepare('SELECT * FROM waiver_signatures WHERE student_id=? ORDER BY slot, signed_at DESC').all(studentId);
}
export function hasSignedAllWaivers(studentId) {
  const active = getActiveWaivers();
  if (!active.length) return true; // no waivers configured -> nothing to sign
  const sigs = getStudentWaiverSignatures(studentId);
  return active.every(w => sigs.some(s => s.slot === w.slot && s.waiver_version === w.version));
}
export function recordWaiverSignature({ student_id, slot, waiver_version, signed_name, signature_url, signed_pdf_url }) {
  return getDb().prepare(`INSERT INTO waiver_signatures (student_id,slot,waiver_version,signed_name,signature_url,signed_pdf_url) VALUES (?,?,?,?,?,?)`)
    .run(student_id, slot, waiver_version, signed_name, signature_url || null, signed_pdf_url || null).lastInsertRowid;
}
export function markWaiverEmailed(id) {
  getDb().prepare(`UPDATE waiver_signatures SET emailed_at=datetime('now') WHERE id=?`).run(id);
}
export function getAllSignedWaivers() {
  return getDb().prepare(`
    SELECT ws.*, s.name as student_name, wd.title as waiver_title
    FROM waiver_signatures ws
    JOIN students s ON s.id = ws.student_id
    LEFT JOIN waiver_documents wd ON wd.slot = ws.slot
    ORDER BY ws.signed_at DESC`).all();
}

// ─────────────────────────────────────────────────────────────────────────────
// BILLS
// ─────────────────────────────────────────────────────────────────────────────
export function getBillsForStudent(studentId) {
  return getDb().prepare('SELECT * FROM student_bills WHERE student_id=? ORDER BY uploaded_at DESC').all(studentId);
}
export function createBill({ student_id, title, filename, url, r2_key, uploaded_by, uploader_type, notes }) {
  return getDb().prepare(
    'INSERT INTO student_bills (student_id,title,filename,url,r2_key,uploaded_by,uploader_type,notes) VALUES (?,?,?,?,?,?,?,?)'
  ).run(student_id, title||filename, filename, url||null, r2_key||null, uploaded_by||null, uploader_type||'instructor', notes||null).lastInsertRowid;
}
export function deleteBill(id) {
  getDb().prepare('DELETE FROM student_bills WHERE id=?').run(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT PROOFS
// ─────────────────────────────────────────────────────────────────────────────
export function getPaymentProof(paymentId) {
  return getDb().prepare('SELECT * FROM payment_proofs WHERE payment_id=?').get(paymentId);
}
export function createPaymentProof({ payment_id, filename, url, r2_key }) {
  getDb().prepare('INSERT OR REPLACE INTO payment_proofs (payment_id,filename,url,r2_key) VALUES (?,?,?,?)').run(payment_id, filename, url||null, r2_key||null);
}

// ─────────────────────────────────────────────────────────────────────────────
// SITE PHOTOS
// ─────────────────────────────────────────────────────────────────────────────
export function getSitePhoto(site_key, site_type) {
  return getDb().prepare('SELECT * FROM site_photos WHERE site_key=? AND site_type=?').get(site_key, site_type);
}
export function getAllSitePhotos() {
  return getDb().prepare('SELECT * FROM site_photos').all();
}
export function upsertSitePhoto({ site_key, site_type, filename, url, r2_key, uploaded_by }) {
  getDb().prepare(`
    INSERT INTO site_photos (site_key, site_type, filename, url, r2_key, uploaded_by)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(site_key, site_type) DO UPDATE SET filename=excluded.filename, url=excluded.url, r2_key=excluded.r2_key, uploaded_by=excluded.uploaded_by, uploaded_at=datetime('now')
  `).run(site_key, site_type, filename, url||null, r2_key||null, uploaded_by||null);
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS V47 — per-student progression
// ─────────────────────────────────────────────────────────────────────────────
export function getStudentProgression(studentId) {
  const db = getDb();
  const exTotal   = db.prepare('SELECT COUNT(DISTINCT id) as n FROM exercises').get().n;
  const exPassed  = db.prepare("SELECT COUNT(DISTINCT exercise_id) as n FROM exercise_logs WHERE student_id=? AND status='passed'").get(studentId).n;
  const exPending = db.prepare("SELECT COUNT(DISTINCT exercise_id) as n FROM exercise_logs WHERE student_id=? AND status='pending'").get(studentId).n;
  const ghTotal   = db.prepare("SELECT COUNT(DISTINCT id) as n FROM exercises WHERE category='ground_handling'").get().n;
  const ghPassed  = db.prepare("SELECT COUNT(DISTINCT el.exercise_id) as n FROM exercise_logs el JOIN exercises ex ON ex.id=el.exercise_id WHERE el.student_id=? AND el.status='passed' AND ex.category='ground_handling'").get(studentId).n;
  const airTotal  = db.prepare("SELECT COUNT(DISTINCT id) as n FROM exercises WHERE category='airborne'").get().n;
  const airPassed = db.prepare("SELECT COUNT(DISTINCT el.exercise_id) as n FROM exercise_logs el JOIN exercises ex ON ex.id=el.exercise_id WHERE el.student_id=? AND el.status='passed' AND ex.category='airborne'").get(studentId).n;
  const thTotal   = db.prepare('SELECT COUNT(*) as n FROM theory_blocks').get().n;
  const thDone    = db.prepare('SELECT COUNT(*) as n FROM theory_progress WHERE student_id=? AND completed=1').get(studentId).n;
  const thP1Total = db.prepare("SELECT COUNT(*) as n FROM theory_blocks WHERE phase='p1'").get().n;
  const thP1Done  = db.prepare("SELECT COUNT(*) as n FROM theory_progress tp JOIN theory_blocks tb ON tb.id=tp.block_id WHERE tp.student_id=? AND tp.completed=1 AND tb.phase='p1'").get(studentId).n;
  const flightCount = db.prepare("SELECT COUNT(*) as n FROM flights WHERE student_id=? AND status='complete'").get(studentId).n;
  const lastFlight  = db.prepare("SELECT date FROM flights WHERE student_id=? AND status='complete' ORDER BY date DESC LIMIT 1").get(studentId);
  const lastExLog   = db.prepare("SELECT date FROM exercise_logs WHERE student_id=? ORDER BY id DESC LIMIT 1").get(studentId);
  const examsPassed = db.prepare("SELECT COUNT(*) as n FROM exam_attempts WHERE student_id=? AND passed=1 AND signed_off_at IS NOT NULL").get(studentId).n;
  const theoryExams = db.prepare("SELECT COUNT(*) as n FROM exam_defs WHERE type='theory'").get().n;
  const theoryExamsPassed = db.prepare("SELECT COUNT(DISTINCT ea.exam_id) as n FROM exam_attempts ea JOIN exam_defs ed ON ed.id=ea.exam_id WHERE ea.student_id=? AND ea.passed=1 AND ea.signed_off_at IS NOT NULL AND ed.type='theory'").get(studentId).n;
  const pendingSignoffs = db.prepare("SELECT COUNT(*) as n FROM exercise_logs WHERE student_id=? AND status='pending'").get(studentId).n;
  return {
    exTotal, exPassed, exPending, ghTotal, ghPassed, airTotal, airPassed,
    thTotal, thDone, thP1Total, thP1Done, flightCount, examsPassed,
    theoryExams, theoryExamsPassed, pendingSignoffs,
    lastActivity: lastFlight?.date || lastExLog?.date || null,
  };
}

export function getAllStudentsProgression() {
  const db = getDb();
  const students = db.prepare('SELECT id, name FROM students WHERE active=1 ORDER BY name').all();
  return students.map(s => ({ ...s, ...getStudentProgression(s.id) }));
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE PICTURE
// ─────────────────────────────────────────────────────────────────────────────
export function updateStudentProfilePicture(studentId, url) {
  getDb().prepare('UPDATE students SET profile_picture_url=? WHERE id=?').run(url, studentId);
}
export function getStudentById(id) {
  return getDb().prepare('SELECT * FROM students WHERE id=?').get(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// FLIGHT DEBRIEFINGS
// ─────────────────────────────────────────────────────────────────────────────
export function runDebriefingMigration(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS flight_debriefings (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_id       INTEGER NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
      student_id      INTEGER REFERENCES students(id),
      phases_requested TEXT DEFAULT '[]',
      instructor_id   INTEGER REFERENCES instructors(id),
      content         TEXT,
      status          TEXT DEFAULT 'pending',
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME
    );
    CREATE TABLE IF NOT EXISTS debriefing_media (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      debriefing_id   INTEGER NOT NULL REFERENCES flight_debriefings(id) ON DELETE CASCADE,
      uploaded_by     INTEGER,
      uploader_type   TEXT DEFAULT 'instructor',
      r2_key          TEXT,
      url             TEXT,
      type            TEXT DEFAULT 'photo',
      caption         TEXT,
      uploaded_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
export function getPendingDebriefs() {
  return getDb().prepare(`
    SELECT d.*, s.name as student_name, f.date as flight_date, f.site as flight_site
    FROM flight_debriefings d
    JOIN students s ON s.id = d.student_id
    JOIN flights f ON f.id = d.flight_id
    WHERE d.status = 'pending'
    ORDER BY d.created_at DESC
  `).all();
}

export function getDebriefingsForFlight(flightId) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT d.*, s.name as student_name, i.name as instructor_name
    FROM flight_debriefings d
    LEFT JOIN students s ON s.id = d.student_id
    LEFT JOIN instructors i ON i.id = d.instructor_id
    WHERE d.flight_id = ?
    ORDER BY d.created_at DESC
  `).all(flightId);
  return rows.map(d => ({
    ...d,
    media: db.prepare('SELECT * FROM debriefing_media WHERE debriefing_id=? ORDER BY uploaded_at ASC').all(d.id)
  }));
}
export function createDebriefingRequest({ flight_id, student_id, phases_requested }) {
  return getDb().prepare(
    'INSERT INTO flight_debriefings (flight_id, student_id, phases_requested) VALUES (?,?,?)'
  ).run(flight_id, student_id, JSON.stringify(phases_requested)).lastInsertRowid;
}
export function updateDebriefing({ id, instructor_id, content, status }) {
  getDb().prepare(
    `UPDATE flight_debriefings SET instructor_id=?, content=?, status=?, updated_at=datetime('now') WHERE id=?`
  ).run(instructor_id, content, status || 'done', id);
}
export function addDebriefingToFlight({ flight_id, instructor_id, content }) {
  // Create a new debriefing directly from instructor (no student request)
  return getDb().prepare(
    `INSERT INTO flight_debriefings (flight_id, instructor_id, content, status, phases_requested) VALUES (?,?,?,'done','[]')`
  ).run(flight_id, instructor_id, content).lastInsertRowid;
}
export function addDebriefingMedia({ debriefing_id, uploaded_by, uploader_type, url, r2_key, type, caption }) {
  return getDb().prepare(
    'INSERT INTO debriefing_media (debriefing_id,uploaded_by,uploader_type,url,r2_key,type,caption) VALUES (?,?,?,?,?,?,?)'
  ).run(debriefing_id, uploaded_by||null, uploader_type||'instructor', url||'', r2_key||'', type||'photo', caption||'').lastInsertRowid;
}

export function createRegistrationRequest({ name, phone, email, message }) {
  return getDb().prepare(
    "INSERT INTO registration_requests (name,phone,email,message) VALUES (?,?,?,?)"
  ).run(name, phone||null, email||null, message||null).lastInsertRowid;
}
export function getPendingRegistrations() {
  try { return getDb().prepare("SELECT * FROM registration_requests WHERE status='pending' ORDER BY created_at DESC").all(); }
  catch(e) { return []; }
}
// approveRegistration is handled inline in the server action (no require() needed here)
export function rejectRegistration(id) {
  try { getDb().prepare("UPDATE registration_requests SET status='rejected' WHERE id=?").run(id); } catch(e) {}
}

// ── Flight removal requests ────────────────────────────────────────────────
export function requestFlightRemoval({ flight_id, student_id, reason }) {
  return getDb().prepare(
    'INSERT INTO flight_removal_requests (flight_id, student_id, reason) VALUES (?, ?, ?)'
  ).run(flight_id, student_id, reason || null).lastInsertRowid;
}

export function getPendingFlightRemovals() {
  return getDb().prepare(`
    SELECT frr.*, s.name as student_name, f.date as flight_date, f.duration_sec, f.site
    FROM flight_removal_requests frr
    JOIN students s ON s.id = frr.student_id
    JOIN flights  f ON f.id = frr.flight_id
    WHERE frr.status = 'pending'
    ORDER BY frr.requested_at DESC
  `).all();
}

export function approveFlightRemoval(requestId, instructorId) {
  const db = getDb();
  const req = db.prepare('SELECT flight_id FROM flight_removal_requests WHERE id = ? AND status = ?').get(requestId, 'pending');
  if (!req) return false;
  db.prepare("UPDATE flight_removal_requests SET status='approved', processed_at=datetime('now'), processed_by=? WHERE id=?").run(instructorId, requestId);
  db.prepare('DELETE FROM flights WHERE id = ?').run(req.flight_id);
  return true;
}

export function denyFlightRemoval(requestId, instructorId) {
  return getDb().prepare("UPDATE flight_removal_requests SET status='denied', processed_at=datetime('now'), processed_by=? WHERE id=?")
    .run(instructorId, requestId).changes > 0;
}

export function hasPendingFlightRemovalRequest(flightId, studentId) {
  const row = getDb().prepare(
    "SELECT id FROM flight_removal_requests WHERE flight_id=? AND student_id=? AND status='pending'"
  ).get(flightId, studentId);
  return !!row;
}
