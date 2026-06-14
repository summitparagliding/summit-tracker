import { derived } from 'svelte/store';
import { lang } from '$lib/stores/lang.js';
import en from './en.js';
import fr from './fr.js';

const translations = { en, fr };

export const t = derived(lang, ($lang) => {
  const dict = translations[$lang] || en;
  return (key, vars = {}) => {
    let str = dict[key] ?? en[key] ?? key;
    // Replace {name}, {n} etc.
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, v);
    }
    return str;
  };
});
