import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const saved = browser ? (localStorage.getItem('summit_lang') || 'en') : 'en';
export const lang = writable(saved);

if (browser) {
  lang.subscribe(v => localStorage.setItem('summit_lang', v));
}
