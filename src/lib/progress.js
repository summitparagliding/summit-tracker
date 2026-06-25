// Single source of truth for "overall training progress".
//
// Every progress figure in the app (dashboard training-path card, dashboard
// course-progress card, profile ring, instructor views) must call this so they
// all show the EXACT same number. It is the weighted average of the nine
// curriculum milestones (each 0..1), matching the training-path timeline.

const clamp = v => Math.min(1, Math.max(0, v || 0));

export function overallProgress({ exercises = [], exams = [], theory = [], readiness = null, stats = {} } = {}) {
  // Ground handling
  const groundDone  = readiness?.ghPassed ?? exercises.filter(e => e.category === 'ground_handling' && e.status === 'passed').length;
  const groundTotal = readiness?.ghTotal  ?? exercises.filter(e => e.category === 'ground_handling').length;

  // Airborne split into in-flight vs P2 by the 'P2 — ' title prefix
  const airborneAll  = exercises.filter(e => e.category === 'airborne');
  const inFlightExs  = airborneAll.filter(e => !e.exercise_title?.startsWith('P2 — '));
  const p2Exs        = airborneAll.filter(e =>  e.exercise_title?.startsWith('P2 — '));
  const inFlightTotal = inFlightExs.length || 19;
  const p2ExTotal     = p2Exs.length || 15;
  const inFlightDone  = Math.min(inFlightExs.filter(e => e.status === 'passed').length, inFlightTotal);
  const p2ExDone      = Math.min(p2Exs.filter(e => e.status === 'passed').length, p2ExTotal);

  // Flights
  const flightCount  = readiness?.flightCount ?? stats?.flightCount ?? 0;
  const FLIGHT_TOTAL = 25;

  // Theory by phase
  const p1Theory      = theory.filter(t => !t.phase || t.phase === 'p1' || t.phase === 'P1');
  const p1TheoryDone  = readiness?.p1TheoryDone ?? p1Theory.filter(t => t.completed).length;
  const p1TheoryTotal = (readiness?.p1TheoryTotal ?? p1Theory.length) || 9;
  const p2Theory      = theory.filter(t => t.phase === 'p2' || t.phase === 'P2');
  const p2TheoryDone  = p2Theory.filter(t => t.completed).length;
  const p2TheoryTotal = p2Theory.length || 7;

  // Exams
  const p1PracDone = exams.filter(e => (e.phase === 'p1' || e.phase === 'P1') && e.type === 'practical' && e.passed === 1 && e.signed_off_at).length;
  const p1PracTotal = 5;
  const p1ExamOk   = readiness?.p1ExamsPassed > 0 || exams.some(e => (e.phase === 'p1' || e.phase === 'P1') && e.type !== 'practical' && e.passed === 1 && e.signed_off_at);
  const p1ExamWrit = exams.some(e => (e.phase === 'p1' || e.phase === 'P1') && e.type !== 'practical' && e.passed === 1);
  const p2ExamOk   = readiness?.p2ExamsPassed > 0 || exams.some(e => (e.phase === 'p2' || e.phase === 'P2') && e.passed === 1 && e.signed_off_at);
  const p2ExamWrit = exams.some(e => (e.phase === 'p2' || e.phase === 'P2') && e.passed === 1);

  const weights = [
    clamp(p1TheoryDone / Math.max(p1TheoryTotal, 1)),
    clamp(groundDone   / Math.max(groundTotal, 1)),
    clamp(p1PracDone   / Math.max(p1PracTotal, 1)),
    p1ExamOk ? 1 : p1ExamWrit ? 0.5 : 0,
    clamp(flightCount  / Math.max(FLIGHT_TOTAL, 1)),
    clamp(inFlightDone / Math.max(inFlightTotal, 1)),
    clamp(p2ExDone     / Math.max(p2ExTotal, 1)),
    clamp(p2TheoryDone / Math.max(p2TheoryTotal, 1)),
    p2ExamOk ? 1 : p2ExamWrit ? 0.5 : 0,
  ];
  const total = weights.reduce((s, w) => s + w, 0);
  return Math.round((total / weights.length) * 100);
}
