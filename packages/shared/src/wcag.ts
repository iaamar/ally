import type { WcagLevel } from './types.js';
export const WCAG_SC: Record<string, { name: string; level: WcagLevel; url: string }> = {
  '1.1.1': { name: 'Non-text Content', level: 'A', url: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html' },
  '1.2.2': { name: 'Captions (Prerecorded)', level: 'A', url: 'https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html' },
  '1.3.1': { name: 'Info and Relationships', level: 'A', url: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html' },
  '2.1.1': { name: 'Keyboard', level: 'A', url: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html' },
  '2.2.2': { name: 'Pause, Stop, Hide', level: 'A', url: 'https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html' },
  '2.4.1': { name: 'Bypass Blocks', level: 'A', url: 'https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html' },
  '2.4.2': { name: 'Page Titled', level: 'A', url: 'https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html' },
  '2.4.3': { name: 'Focus Order', level: 'A', url: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html' },
  '2.4.4': { name: 'Link Purpose (In Context)', level: 'A', url: 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html' },
  '2.4.6': { name: 'Headings and Labels', level: 'AA', url: 'https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html' },
  '2.4.7': { name: 'Focus Visible', level: 'AA', url: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html' },
  '2.5.8': { name: 'Target Size (Minimum)', level: 'AA', url: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html' },
  '3.1.1': { name: 'Language of Page', level: 'A', url: 'https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html' },
  '3.2.1': { name: 'On Focus', level: 'A', url: 'https://www.w3.org/WAI/WCAG22/Understanding/on-focus.html' },
  '3.3.2': { name: 'Labels or Instructions', level: 'A', url: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html' },
  '4.1.2': { name: 'Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html' },
};
