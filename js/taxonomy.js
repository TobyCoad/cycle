// taxonomy.js — shared constants for flows/symptoms/moods/etc. Owner: Agent 1.
// Keys are FROZEN per spec; other agents render label/emoji.

export const FLOWS = [
  { key: 'spotting', label: 'Spotting', emoji: '🩸' },
  { key: 'light',    label: 'Light',    emoji: '🩸' },
  { key: 'medium',   label: 'Medium',   emoji: '🩸' },
  { key: 'heavy',    label: 'Heavy',    emoji: '🩸' }
];

export const SYMPTOMS = [
  { key: 'cramps',         label: 'Cramps',         emoji: '⚡' },
  { key: 'headache',       label: 'Headache',       emoji: '🤕' },
  { key: 'backache',       label: 'Backache',       emoji: '🦴' },
  { key: 'tender_breasts', label: 'Tender breasts', emoji: '🫸' },
  { key: 'fatigue',        label: 'Fatigue',        emoji: '🥱' },
  { key: 'acne',           label: 'Acne',           emoji: '🫥' },
  { key: 'bloating',       label: 'Bloating',       emoji: '🎈' },
  { key: 'nausea',         label: 'Nausea',         emoji: '🤢' },
  { key: 'cravings',       label: 'Cravings',       emoji: '🍫' },
  { key: 'insomnia',       label: 'Insomnia',       emoji: '🌙' },
  { key: 'diarrhea',       label: 'Diarrhea',       emoji: '💨' },
  { key: 'constipation',   label: 'Constipation',   emoji: '🪨' },
  { key: 'dizziness',      label: 'Dizziness',      emoji: '💫' },
  { key: 'hot_flashes',    label: 'Hot flashes',    emoji: '🔥' }
];

export const MOODS = [
  { key: 'happy',       label: 'Happy',       emoji: '😊' },
  { key: 'calm',        label: 'Calm',        emoji: '😌' },
  { key: 'energetic',   label: 'Energetic',   emoji: '⚡' },
  { key: 'sad',         label: 'Sad',         emoji: '😢' },
  { key: 'anxious',     label: 'Anxious',     emoji: '😰' },
  { key: 'irritable',   label: 'Irritable',   emoji: '😤' },
  { key: 'mood_swings', label: 'Mood swings', emoji: '🎢' },
  { key: 'stressed',    label: 'Stressed',    emoji: '😫' },
  { key: 'low_energy',  label: 'Low energy',  emoji: '🪫' },
  { key: 'focused',     label: 'Focused',     emoji: '🎯' }
];

export const DISCHARGE = [
  { key: 'none',     label: 'None',      emoji: '⭕' },
  { key: 'sticky',   label: 'Sticky',    emoji: '🍯' },
  { key: 'creamy',   label: 'Creamy',    emoji: '🥛' },
  { key: 'eggwhite', label: 'Egg white', emoji: '🥚' },
  { key: 'watery',   label: 'Watery',    emoji: '💧' },
  { key: 'spotting', label: 'Spotting',  emoji: '🩸' },
  { key: 'unusual',  label: 'Unusual',   emoji: '❗' }
];

export const SEX = [
  { key: 'protected',    label: 'Protected sex',   emoji: '🛡️' },
  { key: 'unprotected',  label: 'Unprotected sex', emoji: '❤️‍🔥' },
  { key: 'high_drive',   label: 'High sex drive',  emoji: '🔥' },
  { key: 'masturbation', label: 'Masturbation',    emoji: '✨' }
];

export const MEDS = [
  { key: 'pill',       label: 'Contraceptive pill', emoji: '💊' },
  { key: 'painkiller', label: 'Painkiller',         emoji: '💊' },
  { key: 'vitamins',   label: 'Vitamins',           emoji: '🍊' },
  { key: 'other',      label: 'Other',              emoji: '➕' }
];

// V3 (Agent C): pain-level bands for the 0-10 scale. min/max are inclusive.
export const PAIN_LEVELS = [
  { key: 'none',        label: 'None',        emoji: '🤍', min: 0, max: 0 },
  { key: 'mild',        label: 'Mild',        emoji: '💛', min: 1, max: 3 },
  { key: 'moderate',    label: 'Moderate',    emoji: '🧡', min: 4, max: 6 },
  { key: 'severe',      label: 'Severe',      emoji: '❤️‍🩹', min: 7, max: 8 },
  { key: 'very_severe', label: 'Very severe', emoji: '💔', min: 9, max: 10 }
];

// Convenience lookup: labelFor(SYMPTOMS, 'cramps') -> 'Cramps'
export function labelFor(list, key) {
  const item = list.find(i => i.key === key);
  return item ? item.label : key;
}

export function emojiFor(list, key) {
  const item = list.find(i => i.key === key);
  return item ? item.emoji : '';
}
