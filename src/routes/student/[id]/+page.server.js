import { getFlightsForStudent, getStudentDashboard, getStudentEquipment, saveStudentEquipment,
         getNotifications, getUpcomingTrainingDays, markNotificationsRead,
         registerForTrainingDay, unregisterFromTrainingDay, getPayments,
         getMessagesForStudent, getOrdersForStudent, deleteStudentSession, markMessageRead, getUnviewedDebriefings, getStudentBillingInfo, getBillsForStudent, getStudentReadiness } from '$lib/server/db.js';
import { redirect } from '@sveltejs/kit';

export function load({ params, cookies }) {
  const id = Number(params.id);
  const tok = cookies.get('student_session');
  // Mark all messages as read on dashboard load
  try {
    const msgs = getMessagesForStudent(id);
    msgs.forEach(m => markMessageRead(m.id, id));
  } catch(e) {}
  return {
    dash:               (() => { try { return getStudentDashboard(id); } catch(e) { console.error('[dash]',e.message); return { stats:{}, pending:[], flights:[] }; } })(),
    equipment:          (() => { try { return getStudentEquipment(id) || {}; } catch(e) { return {}; } })(),
    notifications:      (() => { try { return getNotifications(id);       } catch(e) { return []; } })(),
    trainingDays:       (() => { try { return getUpcomingTrainingDays(id);} catch(e) { return []; } })(),
    messages:           (() => { try { return getMessagesForStudent(id);  } catch(e) { return []; } })(),
    orders:             (() => { try { return getOrdersForStudent(id);    } catch(e) { return []; } })(),
    payments:           (() => { try { return getPayments(id);            } catch(e) { return []; } })(),
    unviewedDebriefs:   (() => { try { return getUnviewedDebriefings(id); } catch(e) { return []; } })(),
    billing:            (() => { try { return getStudentBillingInfo(id);  } catch(e) { return null; } })(),
    bills:              (() => { try { return getBillsForStudent(id);        } catch(e) { return [];   } })(),
    readiness:          (() => { try { return getStudentReadiness(id);         } catch(e) { return null;  } })(),
    recentFlights:      (() => {
      try { return (getFlightsForStudent(id)||[]).filter(f=>f.status==='complete').slice(0,5); }
      catch(e) { return []; }
    })(),
  };
}

export const actions = {
  saveEquipment: async ({ request, params }) => {
    const fd = await request.formData();
    const num = (k) => { const v = fd.get(k); return v ? Number(v) : null; };
    saveStudentEquipment(Number(params.id), {
      glider_make:      fd.get('glider_make')  || null,
      glider_model:     fd.get('glider_model') || null,
      glider_size:      fd.get('glider_size')  || null,
      glider_flat_area: num('glider_flat_area'),
      glider_projected_area: num('glider_projected_area'),
      loading_min:           num('loading_min'),
      loading_max:           num('loading_max'),
      glider_weight:    num('glider_weight'),
      harness:          fd.get('harness')      || null,
      harness_weight:   num('harness_weight'),
      reserve:          fd.get('reserve')      || null,
      reserve_weight:   num('reserve_weight'),
      pilot_weight:     num('pilot_weight'),
      notes:            fd.get('eq_notes')     || null,
    });
    return { equipOk: true };
  },
  rsvp: async ({ request, params }) => {
    const fd = await request.formData();
    const training_day_id = Number(fd.get('training_day_id'));
    const action = fd.get('action');
    const activity_type = fd.get('activity_type') || 'flight';
    const studentId = Number(params.id);
    if (action === 'join') registerForTrainingDay(training_day_id, studentId, activity_type);
    else unregisterFromTrainingDay(training_day_id, studentId);
    return { rsvpOk: true };
  },
  markRead: async ({ params }) => {
    markNotificationsRead(Number(params.id));
    return { readOk: true };
  },
  logout: async ({ cookies }) => {
    try {
      const tok = cookies.get('student_session');
      if (tok) deleteStudentSession(tok);
    } catch(e) { console.error('logout:', e.message); }
    cookies.delete('student_session', { path: '/' });
    throw redirect(303, '/');
  }
};
