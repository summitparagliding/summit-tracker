import { getAllFlights } from '$lib/server/db.js';
export function load() { return { flights: getAllFlights() }; }
