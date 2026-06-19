import { saveStudentColours, getConfidenceTrend, getConfidenceComparison,
  getStudentDashboard, getStudentEquipment, getStudentProgressMap, getBillsForStudent,
  updateStudentContact, getStudentSession, saveStudentEquipment } from '$lib/server/db.js';

export const actions = {
  saveColours: async ({ request, cookies, params }) => {
    const tok  = cookies.get('student_session');
    const sess = tok ? getStudentSession(tok) : null;
    if (!sess) return fail(401);
    const fd = await request.formData();
    const w1 = String(fd.get('wing_color_1') || '#3b82f6');
    const le = String(fd.get('wing_le_color') || '#ffffff');
    const hc = String(fd.get('harness_color') || '#1e293b');
    try {
      saveStudentColours(Number(params.id), w1, le, hc);
      return { coloursOk: true };
    } catch(e) {
      console.error('[saveColours]', e.message);
      return fail(500, { colourError: e.message });
    }
  },
  updateProfile: async ({ request, cookies }) => {
    const tok  = cookies.get('student_session');
    const sess = tok ? getStudentSession(tok) : null;
    if (!sess) return { ok: false };
    const fd = await request.formData();
    try {
      updateStudentContact(sess.student_id, {
        phone:                          fd.get('phone') || '',
        email:                          fd.get('email') || '',
        date_of_birth:                  fd.get('date_of_birth') || '',
        emergency_contact_name:         fd.get('emergency_contact_name') || '',
        emergency_contact_phone:        fd.get('emergency_contact_phone') || '',
        emergency_contact_relationship: fd.get('emergency_contact_relationship') || '',
      });
    } catch(e) { console.error('updateProfile:', e.message); }
    // Save colour fields to equipment table
    try {
      const eq = getStudentEquipment(sess.student_id) || {};
      if (fd.get('wing_color_1') || fd.get('wing_color_2') || fd.get('harness_color')) {
        saveStudentEquipment(sess.student_id, {
          ...eq,
          wing_color_1: fd.get('wing_color_1') || eq.wing_color_1 || '',
          wing_color_2: fd.get('wing_color_2') || eq.wing_color_2 || '',
          wing_le_color: fd.get('wing_le_color') || eq.wing_le_color || '',
          harness_color: fd.get('harness_color') || eq.harness_color || '',
        });
      }
    } catch(e) { console.error('updateProfile colours:', e.message); }
    return { profileOk: true };
  },
};

export function load({ params }) {
  const id = Number(params.id);
  const confidenceTrend = (() => { try { return getConfidenceTrend(id); } catch(e) { return {trend:'neutral',baseline:null,recent:null,last:null,data:[]}; } })();
  return {
    dash:        getStudentDashboard(id),
    equipment:   getStudentEquipment(id) || {},
    progressMap: getStudentProgressMap(id),
    bills:       getBillsForStudent(id),
    confidenceTrend,
    confidenceCompare: (() => { try { return getConfidenceComparison(id); } catch(e) { return {data:[],avgPre:null,avgPost:null,delta:null}; } })(),
  };
}
