/**
 * sanitize.js — Server-side HTML allowlist sanitizer.
 *
 * Purpose: Prevent XSS when user-supplied document content is stored and later
 * rendered in other users' browsers (e.g. via a shared document link).
 *
 * Strategy: Allowlist only the exact tags and attributes produced by Tiptap's
 * StarterKit. Everything else — <script>, event handlers, javascript: URIs,
 * <iframe>, <object> — is stripped before the content reaches the database.
 *
 * This sanitizer runs on the server, not the client, so we use regex-based
 * parsing rather than a DOM parser (no DOM available in Node.js without jsdom).
 * The approach is intentionally conservative: when in doubt, strip the tag.
 */

// ── Allowlisted tags ──────────────────────────────────────────────────────────
// Exactly the set that Tiptap StarterKit can produce. Any tag not in this set
// is stripped (its inner text content may be preserved as a text node).
const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr',
  'strong', 'em', 's', 'code', 'mark',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote',
  'pre',
  'a',
  'img',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'div', 'span',
]);

// ── Allowlisted attributes per tag ───────────────────────────────────────────
// Tags not listed here are allowed with zero attributes.
// The 'href' attribute on <a> is handled separately to block javascript: URIs.
const ALLOWED_ATTRS = {
  a:   ['href', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  td:  ['colspan', 'rowspan'],
  th:  ['colspan', 'rowspan'],
  h1: ['class'], h2: ['class'], h3: ['class'],
  p:   ['class'],
  pre: ['class'],         // code blocks may carry a language class
  code: ['class'],
  span: ['class', 'style'],
  div:  ['class'],
};

// ── Dangerous URI schemes ─────────────────────────────────────────────────────
const DANGEROUS_HREF = /^\s*(javascript|data|vbscript):/i;

// ── Dangerous attribute names ─────────────────────────────────────────────────
// Matches any on* event handler attribute (onclick, onload, onerror, …)
const EVENT_HANDLER_ATTR = /^on[a-z]/i;

/**
 * Parse the attribute string of an opening tag into a key→value map.
 * Handles both quoted (`attr="value"`, `attr='value'`) and unquoted forms.
 *
 * @param {string} attrString  — the raw attribute text from inside the tag
 * @returns {Map<string, string>}
 */
function parseAttrs(attrString) {
  const result = new Map();
  // Match: attrName, then optionally = followed by "value", 'value', or bareword
  const re = /([a-zA-Z][a-zA-Z0-9\-:]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*)))?/g;
  let m;
  while ((m = re.exec(attrString)) !== null) {
    const name  = m[1].toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? '';
    result.set(name, value);
  }
  return result;
}

/**
 * Rebuild a safe attribute string from the parsed attr map, applying the
 * per-tag allowlist and stripping dangerous values.
 *
 * @param {string} tag
 * @param {Map<string, string>} attrs
 * @returns {string}
 */
function buildSafeAttrs(tag, attrs) {
  const allowed = ALLOWED_ATTRS[tag] || [];
  const parts = [];
  for (const [name, value] of attrs) {
    // Drop event handlers regardless of allowlist
    if (EVENT_HANDLER_ATTR.test(name)) continue;
    // Drop style attributes on all except span (Tiptap uses inline styles for text colour)
    if (name === 'style' && tag !== 'span' && tag !== 'div') continue;
    if (!allowed.includes(name)) continue;

    // For href: block javascript:/data:/vbscript: URIs
    if (name === 'href' && DANGEROUS_HREF.test(value)) continue;

    // Escape double quotes in attribute values to prevent attribute injection
    const safe = value.replace(/"/g, '&quot;');
    parts.push(`${name}="${safe}"`);
  }
  return parts.length ? ' ' + parts.join(' ') : '';
}

/**
 * Sanitize an HTML string, returning a version safe to store and render.
 *
 * @param {string} html
 * @returns {string}
 */
export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';

  // Process the HTML string character by character using a tag regex.
  // We replace each tag with either a sanitized version or nothing.
  return html.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?\s*\/?>/g,
    (fullMatch, tagName, attrString) => {
      const tag = tagName.toLowerCase();

      if (!ALLOWED_TAGS.has(tag)) {
        // Unknown/dangerous tag — drop the tag entirely (content may survive
        // as a text node in the surrounding flow; scripts are dropped whole).
        return '';
      }

      // Self-closing detection
      const isSelfClose = fullMatch.trimEnd().endsWith('/>');
      // Closing tag detection
      const isClose = fullMatch.startsWith('</');

      if (isClose) return `</${tag}>`;

      const attrs = attrString ? parseAttrs(attrString) : new Map();
      const safeAttrs = buildSafeAttrs(tag, attrs);

      return isSelfClose ? `<${tag}${safeAttrs} />` : `<${tag}${safeAttrs}>`;
    }
  );
}
