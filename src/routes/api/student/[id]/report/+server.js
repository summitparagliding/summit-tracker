import { getDb } from '$lib/server/db.js';
import { error } from '@sveltejs/kit';

export async function GET({ params, locals, url }) {
  // ── Auth ──────────────────────────────────────────────────
  const studentId    = Number(params.id);
  const isInstructor = !!locals.instructor;
  const isOwnStudent = !!locals.student && Number(locals.student.id) === studentId;
  if (!isInstructor && !isOwnStudent) throw error(403, 'Unauthorized');

  const db = getDb();
  const student = db.prepare('SELECT * FROM students WHERE id=?').get(studentId);
  if (!student) throw error(404, 'Student not found');

  const lang = url.searchParams.get('lang') || 'fr';
  const FR   = lang === 'fr';

  try {
    const pdfBuffer = await buildPDF(db, student, FR);
    const safeName  = student.name.replace(/[^a-zA-Z0-9À-ÿ\s\-]/g, '').trim();
    const docTitle  = FR ? "Carnet d'exercice et de vol" : 'Flight & Exercise Logbook';
    const filename  = `${safeName} - ${docTitle}.pdf`;

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length':      String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('[PDF] Error:', err?.message, '\n', err?.stack);
    throw error(500, `PDF error: ${err?.message}`);
  }
}

async function buildPDF(db, student, FR) {
  // Dynamic imports — Vite must not bundle these
  const { default: PDFDocument } = await import('pdfkit');
  const { readFileSync }         = await import('fs');
  const { resolve }              = await import('path');

  // Load logos — try static/ (dev) then build/client/ (production)
  function loadAsset(name) {
    for (const base of [
      resolve(process.cwd(), 'static'),
      resolve(process.cwd(), 'build', 'client'),
    ]) {
      try { return readFileSync(resolve(base, name)); } catch {}
    }
    throw new Error(`Asset not found: ${name}`);
  }
  const summitLogoHires = loadAsset('summit-logo-hires.png');
  const hpacLogo   = loadAsset('hpac-logo.png');

  const studentId = student.id;

  // ── Data queries ─────────────────────────────────────────
  const flights = db.prepare(`
    SELECT f.*, COALESCE(f.landing_site,'') AS landing_site,
           COALESCE(f.start_time,'') AS start_time,
           COALESCE(f.end_time,'')   AS end_time,
           COALESCE(f.launch_type,'') AS launch_type
    FROM flights f
    WHERE f.student_id=? AND f.status='complete'
    ORDER BY f.date ASC, f.created_at ASC
  `).all(studentId);

  const theoryBlocks = db.prepare(`
    SELECT tb.id, tb.title, tb.title_fr, tb.phase, tb.order_idx,
           CASE WHEN tp.completed=1 THEN 1 ELSE 0 END AS completed,
           tp.completed_at
    FROM theory_blocks tb
    LEFT JOIN theory_progress tp ON tp.block_id=tb.id AND tp.student_id=?
    ORDER BY tb.phase, tb.order_idx
  `).all(studentId);

  const examDefs = db.prepare(
    'SELECT * FROM exam_defs ORDER BY type, phase, order_idx'
  ).all();

  const signedAttempts = db.prepare(`
    SELECT ea.* FROM exam_attempts ea
    WHERE ea.student_id=? AND ea.signed_off_at IS NOT NULL
    ORDER BY ea.signed_off_at
  `).all(studentId);

  function bestAttempt(examId) {
    const list = signedAttempts.filter(a => a.exam_id === examId);
    return list.find(a => a.passed === 1) || list[list.length - 1] || null;
  }

  const theoryExams = examDefs.filter(e => e.type === 'theory');
  const practExams  = examDefs.filter(e => e.type === 'practical' || !e.type);

  const exercises = db.prepare(`
    SELECT ex.id, ex.title, ex.title_fr, ex.category, ex.order_idx,
           el.status, el.signed_off_at
    FROM exercises ex
    LEFT JOIN exercise_logs el
      ON el.exercise_id=ex.id AND el.student_id=? AND el.status='passed'
    ORDER BY ex.category, ex.order_idx
  `).all(studentId);

  // ── Stats ────────────────────────────────────────────────
  const totalSecs  = flights.reduce((s, f) => s + (f.duration_seconds || 0), 0);
  const totalH     = Math.floor(totalSecs / 3600);
  const totalM     = Math.floor((totalSecs % 3600) / 60);
  const airtimeFmt = totalH > 0 ? `${totalH}h ${totalM}m` : `${totalM}m`;
  const exPassed   = exercises.filter(e => e.status === 'passed').length;
  const thDone     = theoryBlocks.filter(b => b.completed).length;
  const examsDone  = [...theoryExams, ...practExams]
                       .filter(e => bestAttempt(e.id)?.passed === 1).length;
  const examsTotal = theoryExams.length + practExams.length;

  // ── Helpers ──────────────────────────────────────────────
  function loc(obj, f) {
    return (FR && obj[`${f}_fr`]) ? obj[`${f}_fr`] : (obj[f] || '');
  }
  function fmtDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString(FR ? 'fr-CA' : 'en-CA'); }
    catch { return String(d); }
  }
  function fmtDur(s) {
    if (!s) return '—';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  function stars(n) { return n ? `${n}/5` : '—'; }
  const SITE = {
    ne:'NE', n:'N', o:'O', s:'S', n_club:'Club N',
    o_jardin:'Jardin O', o_alt:'Alt. O', s_alt:'Alt. S',
    arbrissage: FR ? 'Arbrissage' : 'Trees',
  };
  const sn = s => SITE[s] || (s || '—').replace(/_/g, ' ');
  const FTYPE = {
    regular: FR ? 'Régulier' : 'Regular', soaring: 'Soaring',
    thermal: FR ? 'Thermique' : 'Thermal', thermal_soaring: 'Therm+Soar',
  };
  const ft  = t => FTYPE[t] || t || '—';
  const lch = t => t === 'forward' ? (FR ? 'Face' : 'Fwd') :
                   t === 'reverse' ? (FR ? 'Dos'  : 'Rev') : '—';
  const now = fmtDate(new Date().toISOString());

  // ── PDF doc ──────────────────────────────────────────────
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 36, bottom: 36, left: 36, right: 36 },
    autoFirstPage: true,
    bufferPages: true,
    info: {
      Title:   FR ? `Carnet d'exercice et de vol — ${student.name}` : `Flight & Exercise Logbook — ${student.name}`,
      Author:  'Summit Paragliding',
      Subject: 'HPAC/ACVL SOP 410-9',
    },
  });

  const chunks = [];
  doc.on('data', c => chunks.push(c));

  const PW   = doc.page.width;
  const PH   = doc.page.height;
  const LEFT = 36;
  const RIGHT = PW - 36;
  const W    = RIGHT - LEFT;

  const C = {
    teal:   '#00b87a', aqua: '#00e8c6', indigo: '#003C4E',
    dark:   '#1a2332', muted: '#6b8da8', green: '#16a34a',
    red:    '#dc2626', amber: '#d97706', rowA: '#f4f8fc',
    border: '#daeaf5', hdrBg: '#daeaf5',
  };

  function needsPage(h = 60) {
    if (doc.y + h > PH - 50) { doc.addPage(); doc.y = 36; }
  }

  // ── HEADER — white background, native vector logo, fine lines ────────
  // Fine accent lines at very top (two-tone, hairline weight)
  doc.save().strokeColor(C.teal).lineWidth(1.2)
     .moveTo(0, 1.2).lineTo(PW, 1.2).stroke().restore();
  doc.save().strokeColor(C.indigo).lineWidth(0.35).opacity(0.5)
     .moveTo(0, 3).lineTo(PW, 3).stroke().restore();

  // ── Summit logo — actual PNG image ────────────────────────────────────
  const logoH = 48;
  const logoW = Math.round(logoH * (1200 / 581));
  doc.image(summitLogoHires, LEFT, 8, { height: logoH });

  // HPAC logo
  const hpacH = 37, hpacW = Math.round(hpacH * (502 / 350));
  doc.image(hpacLogo, RIGHT - hpacW, 16, { height: hpacH });

  // Centre title (between logo and HPAC)
  const cx = LEFT + logoW + 8, cw = RIGHT - hpacW - 8 - (LEFT + logoW + 8);
  if (cw > 40) {
    doc.fillColor(C.indigo).font('Helvetica-Bold').fontSize(10)
       .text(FR ? "Carnet d'exercice et de vol" : 'Flight & Exercise Logbook',
             cx, 18, { width: cw, align: 'center' });
    doc.fillColor(C.muted).font('Helvetica').fontSize(6)
       .text('HPAC/ACVL SOP 410-9', cx, 31, { width: cw, align: 'center' });
  }

  // Fine separator line below logo area
  doc.save().strokeColor(C.teal).lineWidth(0.6).opacity(0.35)
     .moveTo(LEFT, 62).lineTo(RIGHT, 62).stroke().restore();

  // Student name + dates (light colours on white)
  doc.fillColor(C.indigo).font('Helvetica-Bold').fontSize(13)
     .text(student.name, LEFT, 66, { width: W * 0.58 });
  doc.fillColor(C.muted).font('Helvetica').fontSize(7)
     .text(
       `${FR ? 'Inscrit·e le' : 'Enrolled'}: ${fmtDate(student.enrollment_date)}   ·   ${FR ? 'Généré le' : 'Generated'}: ${now}`,
       LEFT, 70, { width: W, align: 'right' }
     );

  doc.y = 96;

  // ── SUMMARY STRIP ────────────────────────────────────────
  const stripY = doc.y + 2, stripH = 34, colW = W / 5;
  doc.save().rect(LEFT, stripY, W, stripH).fill(C.rowA).stroke(C.border).restore();
  // Fine teal accent top line
  doc.save().strokeColor(C.teal).lineWidth(0.8)
     .moveTo(LEFT, stripY).lineTo(RIGHT, stripY).stroke().restore();

  const sumItems = [
    [String(flights.length),                    FR ? 'Vols' : 'Flights'   ],
    [airtimeFmt,                                FR ? 'Temps de vol' : 'Airtime'],
    [`${thDone}/${theoryBlocks.length}`,         FR ? 'Théorie' : 'Theory' ],
    [`${exPassed}/${exercises.length}`,          FR ? 'Exercices' : 'Exercises'],
    [`${examsDone}/${examsTotal}`,               FR ? 'Examens' : 'Exams'  ],
  ];
  sumItems.forEach(([val, lbl], i) => {
    const cx2 = LEFT + i * colW;
    doc.fillColor(C.teal).font('Helvetica-Bold').fontSize(14)
       .text(val, cx2, stripY + 6, { width: colW, align: 'center' });
    doc.fillColor(C.muted).font('Helvetica').fontSize(6)
       .text(lbl.toUpperCase(), cx2, stripY + 22, { width: colW, align: 'center' });
    if (i < 4) {
      doc.save().strokeColor(C.border).lineWidth(0.5)
         .moveTo(LEFT + (i+1)*colW, stripY + 4)
         .lineTo(LEFT + (i+1)*colW, stripY + stripH - 4).stroke().restore();
    }
  });
  doc.y = stripY + stripH + 8;

  // ── Layout helpers ───────────────────────────────────────
  function sectionHeader(title) {
    needsPage(24);
    doc.moveDown(0.25);
    const sy = doc.y;
    doc.rect(LEFT, sy, 3, 13).fill(C.teal);
    doc.rect(LEFT + 3, sy, W - 3, 13).fill(C.indigo);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8)
       .text(title.toUpperCase(), LEFT + 8, sy + 3, { width: W - 12 });
    doc.y = sy + 17;
  }

  function phaseHeader(text) {
    needsPage(16);
    const ph = doc.y;
    doc.rect(LEFT, ph, W, 11).fill('#e8f5f0');
    doc.fillColor(C.indigo).font('Helvetica-Bold').fontSize(7)
       .text(text, LEFT + 4, ph + 2, { width: W - 8 });
    doc.y = ph + 13;
  }

  function tableHead(cols) {
    needsPage(14);
    const hy = doc.y;
    doc.rect(LEFT, hy, W, 11).fill(C.hdrBg);
    let x = LEFT;
    cols.forEach(([label, w, align = 'left']) => {
      doc.fillColor(C.indigo).font('Helvetica-Bold').fontSize(6.2)
         .text(label, x + 2, hy + 2.5, { width: w - 4, align });
      x += w;
    });
    doc.y = hy + 12;
  }

  function tableRow(cells, cols, rowIdx, subH = 0) {
    const MIN_ROW = 11;
    let rowH = MIN_ROW + subH;

    // Pre-measure exact height for every wrapping column
    cells.forEach(({ text = '', bold = false }, ci) => {
      const [, cw] = cols[ci];
      const str = String(text ?? '').trim();
      if (!str || cw < 35) return;
      try {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7);
        // Use width - 6 to match actual text area (2px padding each side + 1px buffer)
        const h = doc.heightOfString(str, { width: cw - 6, lineBreak: true });
        const needed = Math.ceil(h) + 7; // 7pt total vertical padding
        if (needed > rowH) rowH = needed;
      } catch(e) {}
    });

    rowH = Math.max(MIN_ROW, Math.min(rowH, 72)); // clamp 11–72pt
    needsPage(rowH + 4);

    const ry = doc.y;
    // Row background
    if (rowIdx % 2 === 0) doc.rect(LEFT, ry, W, rowH).fill(C.rowA);

    let x = LEFT;
    cells.forEach(({ text, color = C.dark, align = 'left', bold = false }, ci) => {
      const [, cw] = cols[ci];
      const str    = String(text ?? '—').trim() || '—';
      const wrap   = cw >= 35;
      doc.fillColor(color)
         .font(bold ? 'Helvetica-Bold' : 'Helvetica')
         .fontSize(7)
         .text(str, x + 3, ry + 3, {
           width:    cw - 6,   // must match heightOfString width exactly
           align,
           lineBreak:wrap,
           ellipsis: !wrap,
           height:   rowH - 5,  // leave 2pt bottom padding
         });
      x += cw;
    });

    // Move cursor reliably using empty text call (more reliable than doc.y=)
    doc.text('', LEFT, ry + rowH + 1);
  }

  // ════════════════════════════════════════════════════════
  // SECTION 1 — FLIGHT LOG
  // ════════════════════════════════════════════════════════
  sectionHeader(FR ? 'Journal de vols' : 'Flight Log');

  if (!flights.length) {
    doc.fillColor(C.muted).font('Helvetica').fontSize(8)
       .text(FR ? 'Aucun vol complété.' : 'No completed flights.', LEFT);
    doc.moveDown(0.5);
  } else {
    const fCols = [
      ['#',                    14, 'center'],
      [FR?'Date':'Date',       46, 'left'  ],
      [FR?'Déc.':'Launch',     38, 'left'  ],
      [FR?'Att.':'Land',       38, 'left'  ],
      [FR?'Type déc':'Lch',    26, 'left'  ],
      [FR?'Type vol':'Type',   40, 'left'  ],
      [FR?'H.déc':'T/O',       26, 'center'],
      [FR?'H.att':'Lnd',       26, 'center'],
      [FR?'Durée':'Dur',       28, 'center'],
      [FR?'Dist':'Dist',       26, 'center'],
      [FR?'Alt.':'Alt',        26, 'center'],
      [FR?'Vent':'Wind',       28, 'center'],
      [FR?'Déc.':'Lch.',      20, 'center'],
      [FR?'Att.':'Lnd.',      20, 'center'],
      [FR?'Points positifs':'Went well', 0, 'left'],
    ];
    const fixedW = fCols.slice(0, -1).reduce((a, c) => a + c[1], 0);
    fCols[fCols.length - 1][1] = W - fixedW;

    tableHead(fCols);

    flights.forEach((f, i) => {
      // Parse exercise numbers from exercises_done JSON
      let exNums = '';
      if (f.exercises_done) {
        try {
          const arr = JSON.parse(f.exercises_done);
          exNums = arr.map(t => {
            const m = t.match(/#(\d+)/);
            if (m) return `#${m[1]}`;
            const ps = t.match(/^PS-\d+/);
            if (ps) return ps[0];
            const p2 = t.match(/^P2-\d+/);
            if (p2) return p2[0];
            return t.slice(0, 12);
          }).join(' ');
        } catch { exNums = ''; }
      }

      const wind = [f.wind_speed, f.wind_direction].filter(Boolean).join(' ');

      tableRow([
        { text: i + 1,                              color: C.muted,  align: 'center' },
        { text: fmtDate(f.date)                                                       },
        { text: sn(f.site)                                                            },
        { text: f.landing_site ? sn(f.landing_site) : '—'                            },
        { text: lch(f.launch_type)                                                    },
        { text: ft(f.flight_type)                                                     },
        { text: f.start_time || '—',                              align: 'center'     },
        { text: f.end_time   || '—',                              align: 'center'     },
        { text: fmtDur(f.duration_seconds), color: C.green,       align: 'center'     },
        { text: f.distance_km  ? `${f.distance_km}km` : '—',     align: 'center'     },
        { text: f.max_altitude_m ? `${f.max_altitude_m}m` : '—', color: C.teal, align: 'center' },
        { text: wind || '—',                                      align: 'center'     },
        { text: stars(f.launch_quality),            color: C.amber, align: 'center'  },
        { text: stars(f.landing_quality),           color: C.amber, align: 'center'  },
        { text: f.what_went_well || '',             color: C.muted                   },
      ], fCols, i);

      // Sub-row for exercises + notes
      const extras = [
        exNums           ? `${FR?'Exercices:':'Ex:'} ${exNums}` : '',
        f.what_to_improve ? `${FR?'À améliorer:':'Improve:'} ${f.what_to_improve}` : '',
        f.next_goals      ? `${FR?'Objectifs:':'Goals:'} ${f.next_goals}` : '',
        f.personal_notes  ? `${FR?'Notes:':'Notes:'} ${f.personal_notes}` : '',
      ].filter(Boolean);

      if (extras.length) {
        const extText = extras.join('   ·   ');
        doc.font('Helvetica').fontSize(6.5);
        // Measure exact height needed for the notes text
        const measH = doc.heightOfString(extText, { width: W - 24, lineBreak: true });
        const subH  = Math.max(11, Math.min(Math.ceil(measH) + 6, 40));
        needsPage(subH + 2);
        const ry2 = doc.y;
        if (i % 2 === 0) doc.rect(LEFT, ry2, W, subH).fill(C.rowA);
        doc.fillColor(C.muted)
           .text(extText, LEFT + 4, ry2 + 2, {
             width: W - 8,
             lineBreak: true,
             height: subH - 3,
             ellipsis: true,
           });
        // Reliable cursor move
        doc.text('', LEFT, ry2 + subH + 1);
      }
    });

    // Totals row
    needsPage(14);
    const totY = doc.y;
    doc.rect(LEFT, totY, W, 12).fill('#e8f5f0');
    doc.fillColor(C.indigo).font('Helvetica-Bold').fontSize(7)
       .text(
         `${FR ? 'Total' : 'Total'}: ${flights.length} ${FR?'vols':'flights'}   ·   ${airtimeFmt} ${FR?'de vol':'airtime'}`,
         LEFT + 4, totY + 3, { width: W - 8 }
       );
    doc.y = totY + 14;
  }

  // ════════════════════════════════════════════════════════
  // SECTION 2 — THEORY & EXAMS
  // ════════════════════════════════════════════════════════
  sectionHeader(FR ? 'Théorie et examens' : 'Theory & Exams');

  const thCols = [
    [FR?'Bloc théorique':'Theory Block', W - 70, 'left'  ],
    [FR?'Statut':'Status',               30,      'center'],
    [FR?'Date':'Date',                   40,      'left'  ],
  ];

  for (const phase of ['p1', 'p2']) {
    const blocks = theoryBlocks.filter(b => (b.phase || 'p1') === phase);
    if (!blocks.length) continue;
    phaseHeader(`${phase.toUpperCase()} — ${FR?'Blocs théoriques':'Theory Blocks'} (${blocks.filter(b=>b.completed).length}/${blocks.length})`);
    tableHead(thCols);
    blocks.forEach((b, i) => {
      tableRow([
        { text: loc(b, 'title') },
        { text: b.completed ? 'OK' : '—', color: b.completed ? C.green : C.muted, align: 'center', bold: !!b.completed },
        { text: b.completed ? fmtDate(b.completed_at) : '', color: C.muted },
      ], thCols, i);
    });
    doc.moveDown(0.2);
  }

  // Theory exams
  if (theoryExams.length) {
    const eCols = [
      [FR?'Examen théorique':'Theory Exam', W - 90, 'left'],
      [FR?'Résultat':'Result', 35, 'center'],
      [FR?'Note':'Score',      25, 'center'],
      [FR?'Date':'Date',       30, 'left'  ],
    ];
    phaseHeader(FR ? 'Examens théoriques' : 'Theory Exams');
    tableHead(eCols);
    theoryExams.forEach((def, i) => {
      const att = bestAttempt(def.id);
      const passed = att?.passed === 1, failed = att?.passed === 0;
      tableRow([
        { text: loc(def, 'title') },
        { text: passed ? (FR?'Réussi':'Passed') : failed ? (FR?'Échoué':'Failed') : '—',
          color: passed ? C.green : failed ? C.red : C.muted, align: 'center', bold: passed },
        { text: att?.score_pct != null ? `${att.score_pct}%` : '—', align: 'center' },
        { text: att?.signed_off_at ? fmtDate(att.signed_off_at) : '', color: C.muted },
      ], eCols, i);
    });
    doc.moveDown(0.2);
  }

  // Practical exams
  if (practExams.length) {
    const pCols = [
      [FR?'Examen pratique':'Practical Exam', W - 90, 'left'],
      [FR?'Résultat':'Result', 35, 'center'],
      [FR?'Note':'Score',      25, 'center'],
      [FR?'Date':'Date',       30, 'left'  ],
    ];
    phaseHeader(FR ? 'Examens pratiques' : 'Practical Exams');
    tableHead(pCols);
    practExams.forEach((def, i) => {
      const att = bestAttempt(def.id);
      const passed = att?.passed === 1, failed = att?.passed === 0;
      tableRow([
        { text: loc(def, 'title') },
        { text: passed ? (FR?'Réussi':'Passed') : failed ? (FR?'Échoué':'Failed') : '—',
          color: passed ? C.green : failed ? C.red : C.muted, align: 'center', bold: passed },
        { text: att?.score_pct != null ? `${att.score_pct}%` : '—', align: 'center' },
        { text: att?.signed_off_at ? fmtDate(att.signed_off_at) : '', color: C.muted },
      ], pCols, i);
    });
    doc.moveDown(0.2);
  }

  // ════════════════════════════════════════════════════════
  // SECTION 3 — EXERCISES
  // ════════════════════════════════════════════════════════
  sectionHeader(FR ? 'Exercices' : 'Exercises');

  const xCols = [
    [FR?'Exercice':'Exercise',   W - 70, 'left'  ],
    [FR?'Statut':'Status',       30,     'center'],
    [FR?'Validé le':'Validated', 40,     'left'  ],
  ];

  for (const [catKey, catLabel] of [
    ['ground_handling', FR ? 'Sol — Maniement au sol'    : 'Ground Handling'    ],
    ['airborne',        FR ? 'En vol — Techniques de vol': 'In-flight Skills'   ],
  ]) {
    const catExs  = exercises.filter(e => e.category === catKey);
    const catDone = catExs.filter(e => e.status === 'passed').length;
    if (!catExs.length) continue;
    phaseHeader(`${catLabel} — ${catDone}/${catExs.length} ${FR?'réussis':'completed'}`);
    tableHead(xCols);
    catExs.forEach((ex, i) => {
      const done = ex.status === 'passed';
      tableRow([
        { text: loc(ex, 'title'), color: done ? C.dark : C.muted },
        { text: done ? 'OK' : '—', color: done ? C.green : C.muted, align: 'center', bold: done },
        { text: done && ex.signed_off_at ? fmtDate(ex.signed_off_at) : '', color: C.muted },
      ], xCols, i);
    });
    doc.moveDown(0.3);
  }

  // ── FOOTERS ──────────────────────────────────────────────
  // CRITICAL: set page.margins.bottom=0 before writing footers,
  // otherwise text() below the margin triggers extra blank pages
  const totalPages = doc.bufferedPageRange().count;
  const fy = 792 - 20; // absolute y — Letter page = 792pts
  for (let p = 0; p < totalPages; p++) {
    doc.switchToPage(p);
    doc.page.margins.bottom = 0; // allow writing near bottom edge
    doc.save().strokeColor(C.aqua).lineWidth(0.8).opacity(0.55)
       .moveTo(LEFT, fy - 6).lineTo(RIGHT, fy - 6).stroke().restore();
    doc.save().strokeColor(C.indigo).lineWidth(0.35).opacity(0.4)
       .moveTo(LEFT, fy - 4).lineTo(RIGHT, fy - 4).stroke().restore();
    doc.fillColor(C.indigo).font('Helvetica').fontSize(6)
       .text('Summit Paragliding · Mont Yamaska, Qc.', LEFT, fy, { width: W * 0.4, lineBreak: false });
    doc.fillColor(C.muted).font('Helvetica').fontSize(6)
       .text('HPAC/ACVL SOP 410-9', LEFT, fy, { width: W, align: 'center', lineBreak: false });
    doc.fillColor(C.indigo).font('Helvetica').fontSize(6)
       .text(`${p + 1} / ${totalPages}`, LEFT, fy, { width: W, align: 'right', lineBreak: false });
    doc.page.margins.bottom = 36; // restore
  }

  doc.flushPages();
  doc.end();

  return new Promise((resolve, reject) => {
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}
