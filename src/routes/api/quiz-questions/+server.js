import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';

export function GET({ url }) {
  const category = url.searchParams.get('category');
  try {
    const db = getDb();
    let rows;
    if (category && category !== 'all') {
      rows = db.prepare("SELECT * FROM quiz_questions WHERE category=? ORDER BY RANDOM()").all(category);
    } else {
      rows = db.prepare("SELECT * FROM quiz_questions ORDER BY RANDOM()").all();
    }
    return json(rows);
  } catch(e) {
    return json([]);
  }
}
