/**
 * Single source of truth for "does this student have any equipment data?"
 * Returns true if ANY meaningful field is set on the equipment row.
 * Used by both the dashboard and the carnet/logbook page so they can never disagree.
 */
export function hasAnyEquipment(equipment) {
  if (!equipment || typeof equipment !== 'object') return false;

  // Fields that count as "real" equipment data.
  // Excludes id, student_id, created_at, updated_at, and similar metadata.
  const FIELDS = [
    'glider_make', 'glider_model', 'glider_size',
    'glider_flat_area', 'glider_projected_area', 'glider_weight',
    'harness', 'harness_weight',
    'reserve', 'reserve_weight',
    'pilot_weight', 'loading_min', 'loading_max',
    'notes',
    'wing_color_1', 'wing_color_2', 'wing_le_color', 'harness_color',
  ];

  for (const f of FIELDS) {
    const v = equipment[f];
    if (v !== null && v !== undefined && v !== '' && v !== 0) return true;
  }
  return false;
}
