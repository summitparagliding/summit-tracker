<script>
 import Icon from '$lib/components/Icon.svelte';
 export let form;
 const today = new Date().toISOString().slice(0, 10);
</script>

<svelte:head><title>New Student — Instructor</title></svelte:head>

<div class="page-head">
 <div>
 <h1>New Student</h1>
 <p class="muted small">Create a student account with a 4-digit PIN</p>
 </div>
 <a href="/instructor/students" class="btn btn-secondary">← Back</a>
</div>

{#if form?.error}
 <div class="alert alert-err">{form.error}</div>
{/if}

<div class="card form-card">
 <form method="POST">
 <div class="form-row">
 <div class="form-group">
 <label for="name">Full Name *</label>
 <input id="name" name="name" type="text" required placeholder="Jean Tremblay"
 value={form?.values?.name ?? ''} />
 </div>
 <div class="form-group">
 <label for="enrollment_date">Enrollment Date</label>
 <input id="enrollment_date" name="enrollment_date" type="date" value={today} />
 </div>
 </div>

 <div class="form-row">
 <div class="form-group">
 <label for="email">Email</label>
 <input id="email" name="email" type="email" placeholder="student@example.com"
 value={form?.values?.email ?? ''} />
 </div>
 <div class="form-group">
 <label for="phone">Phone</label>
 <input id="phone" name="phone" type="tel" placeholder="+1 438 000 0000"
 value={form?.values?.phone ?? ''} />
 </div>
 </div>

 <div class="form-group">
 <label for="pin">Student PIN * <span class="muted small">(last 4 digits of phone number)</span></label>
 <input id="pin" name="pin" type="text" inputmode="numeric"
 maxlength="4" minlength="4"
 placeholder="0000–9999" required
 value={form?.values?.pin ?? ''}
 style="max-width:140px;letter-spacing:.3em;font-family:var(--ff-head);font-size:1.2rem" />
 </div>

 <div class="form-group">
 <label for="notes">Notes</label>
 <textarea id="notes" name="notes" rows="3"
 placeholder="Experience level, equipment, goals…">{form?.values?.notes ?? ''}</textarea>
 </div>

 <div class="form-section-title">Emergency Contact</div>
 <div class="form-group-row">
   <div class="form-group">
     <label for="ec_name">Name</label>
     <input id="ec_name" name="emergency_contact_name" placeholder="Jane Doe" value={form?.values?.emergency_contact_name??''} />
   </div>
   <div class="form-group">
     <label for="ec_rel">Relationship</label>
     <input id="ec_rel" name="emergency_contact_relationship" placeholder="Parent, spouse…" value={form?.values?.emergency_contact_relationship??''} />
   </div>
 </div>
 <div class="form-group">
   <label for="ec_phone">Emergency Phone</label>
   <input id="ec_phone" name="emergency_contact_phone" type="tel" placeholder="+1 514 000 0000" value={form?.values?.emergency_contact_phone??''} />
 </div>

 <div class="pin-reminder">
 <span></span>
 <p>Use the last 4 digits of their phone number as their PIN — easy to remember, no need to write it down. You can reset it anytime from their profile.</p>
 </div>

 <div class="form-actions">
 <a href="/instructor/students" class="btn btn-secondary">Cancel</a>
 <button type="submit" class="btn btn-primary">Create Student →</button>
 </div>
 </form>
</div>

<style>
 .page-head { display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.5rem; }
 .page-head h1 { font-size:1.75rem; }
 .form-card { max-width:640px; }
 .pin-reminder {
 display:flex;align-items:flex-start;gap:.75rem;
 background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);
 border-radius:var(--r-sm);padding:.875rem 1rem;margin-bottom:1.25rem;
 }
 .pin-reminder span { font-size:1.25rem;flex-shrink:0; }
 .pin-reminder p { font-size:.82rem;color:var(--txt-2);line-height:1.55; }
 .form-actions { display:flex;gap:.75rem;justify-content:flex-end; }
</style>
