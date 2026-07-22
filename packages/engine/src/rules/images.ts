import type { Rule, FindingDraft, RuleCtx } from './index.js';
import type { Elem, ParsedDoc } from '../types.js';
import { hasAttr, attrValue, replaceAttrValueEdit } from './helpers.js';

const WCAG_111_URL = 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html';
const WCAG_122_URL = 'https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html';
const WCAG_412_URL = 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html';

/* ── Heuristic patterns ── */

const FILENAME_RE = /\.(png|jpe?g|gif|svg|webp)$/i;
const PLACEHOLDER_RE = /^(image|img|photo|picture|graphic|icon|untitled|spacer|dsc[-_]?\d*|\d+)$/i;
const REDUNDANT_PHRASE_RE = /\b(image|picture|photo|graphic) of\b/i;

/* ── img-missing-alt ── */

const imgMissingAlt: Rule = {
  meta: {
    id: 'img-missing-alt',
    wcag: ['1.1.1'],
    level: 'A',
    severity: 'critical',
    confidence: 'certain',
    impact: ['screen_reader'],
    fixClass: 'SUGGEST',
    description: 'Images must have an alt attribute or an accessible label.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (elem.tag !== 'img') return null;

    // Exempt if role is presentation or none
    const role = attrValue(elem, 'role');
    if (role === 'presentation' || role === 'none') return null;

    // Has alt (even empty string is fine - means decorative)
    if (hasAttr(elem, 'alt')) return null;

    // Has aria-label or aria-labelledby
    if (hasAttr(elem, 'aria-label') || hasAttr(elem, 'aria-labelledby')) return null;

    return {
      message: 'Image is missing alt text. Add an alt attribute describing the image, or alt="" if decorative.',
      elem,
      packet: {
        hypothesis: 'Image needs a text alternative',
        rubric: [
          'Is the image informative or decorative?',
          'If informative, does the proposed alt convey equivalent meaning?',
          'If decorative, alt must be empty string',
        ],
        citations: [WCAG_111_URL],
      },
    };
  },
};

/* ── img-alt-quality ── */

const imgAltQuality: Rule = {
  meta: {
    id: 'img-alt-quality',
    wcag: ['1.1.1'],
    level: 'A',
    severity: 'serious',
    confidence: 'needs_review',
    impact: ['screen_reader'],
    fixClass: 'SUGGEST',
    description: 'Image alt text should be meaningful, not a filename or placeholder.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (elem.tag !== 'img') return null;

    const alt = attrValue(elem, 'alt');
    // Only fire on literal alt values (not expressions, not absent)
    if (alt === null) return null;
    // Empty alt is valid (decorative)
    if (alt === '') return null;

    if (FILENAME_RE.test(alt) || PLACEHOLDER_RE.test(alt)) {
      return {
        message: `Image alt text "${alt}" appears to be a filename or placeholder. Provide meaningful alt text.`,
        elem,
        packet: {
          hypothesis: 'alt text appears meaningless (filename/placeholder)',
          rubric: [
            'Would this alt make sense read aloud without seeing the image?',
            'Propose a meaningful alt or empty alt if decorative',
          ],
          citations: [WCAG_111_URL],
        },
      };
    }

    return null;
  },
};

/* ── img-redundant-alt ── */

const imgRedundantAlt: Rule = {
  meta: {
    id: 'img-redundant-alt',
    wcag: ['1.1.1'],
    level: 'A',
    severity: 'minor',
    confidence: 'high',
    impact: ['screen_reader'],
    fixClass: 'SUGGEST',
    description: 'Image alt text should not contain redundant phrases like "image of" or "picture of".',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (elem.tag !== 'img') return null;

    const alt = attrValue(elem, 'alt');
    if (alt === null || alt === '') return null;

    if (REDUNDANT_PHRASE_RE.test(alt)) {
      const cleanedAlt = alt.replace(REDUNDANT_PHRASE_RE, '').replace(/\s+/g, ' ').trim();
      return {
        message: `Image alt text contains redundant phrase. Screen readers already announce "image". Consider: "${cleanedAlt}".`,
        elem,
        fix: (e: Elem) => [replaceAttrValueEdit(e, 'alt', cleanedAlt)],
        packet: {
          hypothesis: 'alt text contains redundant "image of" / "picture of" phrase',
          rubric: [
            'Does removing the redundant phrase preserve the meaning?',
            'Is the resulting alt text still descriptive?',
          ],
          citations: [WCAG_111_URL],
        },
      };
    }

    return null;
  },
};

/* ── media-missing-captions ── */

const mediaMissingCaptions: Rule = {
  meta: {
    id: 'media-missing-captions',
    wcag: ['1.2.2'],
    level: 'A',
    severity: 'critical',
    confidence: 'high',
    impact: ['screen_reader'],
    fixClass: 'NEEDS_HUMAN',
    description: 'Video elements must have captions for prerecorded audio content.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (elem.tag !== 'video') return null;

    // Check if any child <track> has kind="captions" or kind="subtitles"
    const hasTrack = elem.children.some((child) => {
      if (child.tag !== 'track') return false;
      const kind = attrValue(child, 'kind');
      return kind === 'captions' || kind === 'subtitles';
    });

    if (hasTrack) return null;

    return {
      message: 'Video element is missing captions. Add a <track kind="captions"> element.',
      elem,
      // No fix — captions must be authored by humans
    };
  },
};

/* ── iframe-missing-title ── */

const iframeMissingTitle: Rule = {
  meta: {
    id: 'iframe-missing-title',
    wcag: ['4.1.2'],
    level: 'A',
    severity: 'serious',
    confidence: 'certain',
    impact: ['screen_reader'],
    fixClass: 'SUGGEST',
    description: 'Iframes must have a descriptive title attribute.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (elem.tag !== 'iframe') return null;

    // If title attr exists as an expression, skip (confidence would be unknowable)
    const titleAttr = elem.attrs['title'];
    if (titleAttr && titleAttr.isExpression) return null;

    const title = attrValue(elem, 'title');
    // Non-empty literal title is fine
    if (title !== null && title.trim() !== '') return null;

    return {
      message: 'Iframe is missing a descriptive title attribute. Add a title that describes the embedded content.',
      elem,
      packet: {
        hypothesis: 'iframe needs a descriptive title',
        rubric: [
          'Does the proposed title describe the embedded content?',
        ],
        citations: [WCAG_412_URL],
      },
    };
  },
};

/* ── Export all image/media rules ── */

export const imageRules: Rule[] = [
  imgMissingAlt,
  imgAltQuality,
  imgRedundantAlt,
  mediaMissingCaptions,
  iframeMissingTitle,
];
