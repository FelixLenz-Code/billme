import test from 'node:test';
import assert from 'node:assert/strict';

const parseCookie = (cookieHeader: string | null, key: string): string | null => {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k !== key) continue;
    const rawValue = v.join('=');
    try {
      const decoded = decodeURIComponent(rawValue);
      return decoded.length > 0 ? decoded : null;
    } catch {
      return rawValue.length > 0 ? rawValue : null;
    }
  }
  return null;
};

test('parseCookie decodes valid values', () => {
  const value = parseCookie('demo_session=abc%20123; other=x', 'demo_session');
  assert.equal(value, 'abc 123');
});

test('parseCookie does not throw on malformed encoding', () => {
  assert.doesNotThrow(() => {
    const value = parseCookie('demo_session=%E0%A4%A; other=x', 'demo_session');
    assert.equal(value, '%E0%A4%A');
  });
});

test('parseCookie returns null for missing cookie', () => {
  const value = parseCookie('other=x', 'demo_session');
  assert.equal(value, null);
});
