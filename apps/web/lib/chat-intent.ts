const CASUAL =
  /^(hi|hey|hello|yo|thanks?|thank you|ok|okay|cool|nice|great|got it|bye|goodbye|good (morning|afternoon|evening|night)|how are you|how(?:'s| is) it going|who are you|what can you do|help)\b[\s!.?,]*$/i;

const CRITERION = /\b\d\.\d{1,2}\.\d{1,2}\b/;

const ACCESSIBILITY_TERMS = [
  'wcag',
  'accessibility',
  'accessible',
  'a11y',
  'aria',
  'screen reader',
  'alt text',
  'alt attribute',
  'contrast',
  'keyboard',
  'focus',
  'landmark',
  'heading',
  'label',
  'semantic',
  'tab order',
  'tabindex',
  'skip link',
  'assistive',
  'voiceover',
  'nvda',
  'jaws',
  'talkback',
  'success criterion',
  'level aa',
  'level aaa',
  'wai-aria',
  'role=',
  'aria-',
  'axe',
  'lighthouse',
  'audit',
  'alt=',
  'contrast ratio',
];

export function needsKnowledgeSearch(
  message: string,
  hasFinding: boolean,
): boolean {
  const trimmed = message.trim();
  if (CASUAL.test(trimmed)) return false;
  if (hasFinding) return true;
  if (CRITERION.test(trimmed)) return true;

  const lower = trimmed.toLowerCase();
  return ACCESSIBILITY_TERMS.some((term) => lower.includes(term));
}
