/**
 * Generate stable initials + background color for an email sender,
 * derived from the email address so the same sender always gets the same color.
 */

const PALETTE = [
  { bg: "bg-rose-500/15", fg: "text-rose-700 dark:text-rose-300" },
  { bg: "bg-orange-500/15", fg: "text-orange-700 dark:text-orange-300" },
  { bg: "bg-amber-500/15", fg: "text-amber-700 dark:text-amber-300" },
  { bg: "bg-yellow-500/15", fg: "text-yellow-700 dark:text-yellow-300" },
  { bg: "bg-lime-500/15", fg: "text-lime-700 dark:text-lime-300" },
  { bg: "bg-green-500/15", fg: "text-green-700 dark:text-green-300" },
  { bg: "bg-emerald-500/15", fg: "text-emerald-700 dark:text-emerald-300" },
  { bg: "bg-teal-500/15", fg: "text-teal-700 dark:text-teal-300" },
  { bg: "bg-cyan-500/15", fg: "text-cyan-700 dark:text-cyan-300" },
  { bg: "bg-sky-500/15", fg: "text-sky-700 dark:text-sky-300" },
  { bg: "bg-blue-500/15", fg: "text-blue-700 dark:text-blue-300" },
  { bg: "bg-indigo-500/15", fg: "text-indigo-700 dark:text-indigo-300" },
  { bg: "bg-violet-500/15", fg: "text-violet-700 dark:text-violet-300" },
  { bg: "bg-purple-500/15", fg: "text-purple-700 dark:text-purple-300" },
  { bg: "bg-fuchsia-500/15", fg: "text-fuchsia-700 dark:text-fuchsia-300" },
  { bg: "bg-pink-500/15", fg: "text-pink-700 dark:text-pink-300" },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export interface AvatarData {
  initials: string;
  bg: string;
  fg: string;
}

export function getAvatarFor(name: string | null, email: string): AvatarData {
  const palette = PALETTE[hashString(email.toLowerCase()) % PALETTE.length];

  let initials: string;
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else {
      initials = parts[0].slice(0, 2).toUpperCase();
    }
  } else {
    initials = email.slice(0, 2).toUpperCase();
  }

  return { initials, bg: palette.bg, fg: palette.fg };
}
