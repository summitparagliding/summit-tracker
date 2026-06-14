import { redirect, fail } from '@sveltejs/kit';
import {
  getInstructorSession, getAllStudents, getStudentEquipment,
  getTodayFlightsWithStatus, updateRosterStatus, addToRoster, removeFromRoster,
} from '$lib/server/db.js';

export function load({ cookies }) {
  const tok  = cookies.get('instructor_session');
  const sess = tok ? getInstructorSession(tok) : null;
  if (!sess) throw redirect(303, '/instructor/login');

  // Flights with live status — students appear the moment they fill preflight
  const roster = getTodayFlightsWithStatus();

  const allStudents = getAllStudents().map(s => {
    const eq = (() => { try { return getStudentEquipment(s.id) || {}; } catch(e) { return {}; } })();
    return {
      ...s,
      wing_color_1:  eq.wing_color_1  || null,
      wing_le_color: eq.wing_le_color || eq.wing_color_2 || null,
      harness_color: eq.harness_color  || null,
    };
  });

  return { roster, allStudents };
}

function getAuth(cookies) {
  const tok  = cookies.get('instructor_session');
  return tok ? getInstructorSession(tok) : null;
}

export const actions = {
  launch: async ({ request, cookies }) => {
    if (!getAuth(cookies)) return fail(401);
    const fd = await request.formData();
    const id = Number(fd.get('student_id'));
    addToRoster(id);
    updateRosterStatus(id, null, 'flying', 'manual');
    return { ok: true };
  },
  land: async ({ request, cookies }) => {
    if (!getAuth(cookies)) return fail(401);
    const fd = await request.formData();
    const id = Number(fd.get('student_id'));
    addToRoster(id);
    updateRosterStatus(id, null, 'landed', 'manual');
    return { ok: true };
  },
  ground: async ({ request, cookies }) => {
    if (!getAuth(cookies)) return fail(401);
    const fd = await request.formData();
    const id = Number(fd.get('student_id'));
    addToRoster(id);
    updateRosterStatus(id, null, 'ground', 'manual');
    return { ok: true };
  },
  add: async ({ request, cookies }) => {
    if (!getAuth(cookies)) return fail(401);
    const fd = await request.formData();
    addToRoster(Number(fd.get('student_id')));
    return { ok: true };
  },
  remove: async ({ request, cookies }) => {
    if (!getAuth(cookies)) return fail(401);
    const fd = await request.formData();
    removeFromRoster(Number(fd.get('student_id')));
    return { ok: true };
  },
};
