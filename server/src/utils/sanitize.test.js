import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeHtml } from './sanitize.js';

describe('sanitizeHtml', () => {
  it('allows safe formatting tags (StarterKit)', () => {
    const input = '<p>Hello <strong>bold</strong> and <em>italic</em></p>';
    assert.equal(sanitizeHtml(input), input);
  });

  it('strips <script> tags entirely', () => {
    const input = '<p>Normal text</p><script>alert(1)</script>';
    const expected = '<p>Normal text</p>alert(1)';
    assert.equal(sanitizeHtml(input), expected);
  });

  it('strips dangerous event handler attributes', () => {
    const input = '<p onclick="stealToken()">Click me</p>';
    const expected = '<p>Click me</p>';
    assert.equal(sanitizeHtml(input), expected);
  });

  it('strips javascript: URIs from links', () => {
    const input = '<a href="javascript:alert(1)">Click me</a>';
    const expected = '<a>Click me</a>'; // href stripped
    assert.equal(sanitizeHtml(input), expected);
  });

  it('allows http: and https: links', () => {
    const input = '<a href="https://example.com" target="_blank">Link</a>';
    assert.equal(sanitizeHtml(input), input);
  });

  it('allows safe attributes on allowed tags', () => {
    const input = '<img src="https://example.com/img.jpg" alt="test" width="100">';
    assert.equal(sanitizeHtml(input), input);
  });

  it('escapes double quotes in attributes to prevent injection', () => {
    const input = '<a href="https://example.com/?q=&quot;onclick=&quot;alert(1)">Link</a>';
    assert.equal(sanitizeHtml(input), '<a href="https://example.com/?q=&quot;onclick=&quot;alert(1)">Link</a>');
  });

  it('strips unknown tags', () => {
    const input = '<p>Allowed</p><object data="evil.swf">Not allowed</object>';
    const expected = '<p>Allowed</p>Not allowed';
    assert.equal(sanitizeHtml(input), expected);
  });

  it('handles self-closing tags', () => {
    const input = '<p>Line 1<br />Line 2</p>';
    assert.equal(sanitizeHtml(input), input);
  });

  it('retains class attributes', () => {
    const input = '<p class="my-class">Test</p>';
    assert.equal(sanitizeHtml(input), input);
  });
});
