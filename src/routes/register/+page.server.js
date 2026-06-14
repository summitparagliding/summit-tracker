import { fail } from '@sveltejs/kit';
import { createRegistrationRequest } from '$lib/server/db.js';

export const actions = {
  default: async ({ request }) => {
    const fd      = await request.formData();
    const name    = fd.get('name')?.trim();
    const phone   = fd.get('phone')?.trim();
    const email   = fd.get('email')?.trim();
    const message = fd.get('message')?.trim();
    if (!name) return fail(400, { error: 'Le nom est requis.' });
    createRegistrationRequest({ name, phone, email, message });
    return { success: true };
  }
};
