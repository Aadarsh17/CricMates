import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a team name into the professional "Name (ABR)" format.
 * e.g., "India" -> "India (IND)", "Chennai Super Kings" -> "Chennai Super Kings (CSK)"
 */
export function formatTeamName(name: string | null | undefined): string {
  if (!name) return '---';
  const trimmed = name.trim();
  // If it already has parentheses with content, assume it's already formatted
  if (/\(.*\)/.test(trimmed)) return trimmed;
  
  const parts = trimmed.split(/\s+/);
  let abbr = '';
  if (parts.length === 1) {
    abbr = trimmed.substring(0, 3).toUpperCase();
  } else {
    // Take first letter of each word
    abbr = parts.map(p => p[0]).join('').toUpperCase().substring(0, 3);
  }
  return `${trimmed} (${abbr})`;
}
