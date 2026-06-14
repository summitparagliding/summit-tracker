import { createStudent } from '$lib/server/db.js';
import { fail, redirect } from '@sveltejs/kit';

export const actions = {
  default: async ({ request }) => {
    const fd   = await request.formData();
    const name = fd.get('name')?.trim();
    const pin  = String(fd.get('pin') ?? '').trim().padStart(4, '0');
    if (!name) return fail(400, { error: 'Name is required.', values: Object.fromEntries(fd) });
    if (pin.length !== 4 || !/^\d{4}$/.test(pin))
      return fail(400, { error: 'PIN must be exactly 4 digits (0000–9999).', values: Object.fromEntries(fd) });
    const id = createStudent({
      name,
      email:           fd.get('email')?.trim()  || null,
      phone:           fd.get('phone')?.trim()  || null,
      pin,
      enrollment_date: fd.get('enrollment_date') || new Date().toISOString().slice(0, 10),
      notes:           fd.get('notes')?.trim()  || null,
      emergency_contact_name:         fd.get('emergency_contact_name')?.trim()         || null,
      emergency_contact_phone:        fd.get('emergency_contact_phone')?.trim()        || null,
      emergency_contact_relationship: fd.get('emergency_contact_relationship')?.trim() || null,
    });
    throw redirect(303, `/instructor/students/${id}`);
  }
};
