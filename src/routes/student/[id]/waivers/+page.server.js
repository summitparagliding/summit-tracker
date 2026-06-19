import { getWaiverDocuments, getStudentWaiverSignatures, hasSignedAllWaivers } from '$lib/server/db.js';

export function load({ locals }) {
  const docs = getWaiverDocuments().filter(d => d.file_url);
  const sigs = getStudentWaiverSignatures(locals.student.id);
  const waivers = docs.map(d => ({
    slot: d.slot,
    title: d.title || `Waiver ${d.slot}`,
    file_url: d.file_url,
    version: d.version,
    recipients: d.recipients,
    optional: !!d.optional,
    signed: sigs.some(s => s.slot === d.slot && s.waiver_version === d.version)
  }));
  return {
    waivers,
    allDone: hasSignedAllWaivers(locals.student.id),
    studentId: locals.student.id
  };
}
