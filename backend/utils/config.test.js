import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isOriginAllowed, parsePositiveInt } from './config.js';

describe('parsePositiveInt configuration validation', () => {
  test('returns default value when input is undefined, null, or empty string', () => {
    assert.equal(parsePositiveInt(undefined, 10, 'TEST_VAL'), 10);
    assert.equal(parsePositiveInt(null, 25, 'TEST_VAL'), 25);
    assert.equal(parsePositiveInt('', 50, 'TEST_VAL'), 50);
  });

  test('parses valid positive integer strings and numbers', () => {
    assert.equal(parsePositiveInt('5000', 3000, 'PORT'), 5000);
    assert.equal(parsePositiveInt(120, 60, 'TIMEOUT'), 120);
    assert.equal(parsePositiveInt('1', 5, 'COUNT'), 1);
  });

  test('throws configuration error when value is zero or negative', () => {
    assert.throws(
      () => parsePositiveInt('0', 10, 'PORT'),
      /Configuration error: PORT must be a positive integer/
    );
    assert.throws(
      () => parsePositiveInt('-5', 10, 'TIMEOUT'),
      /Configuration error: TIMEOUT must be a positive integer/
    );
  });

  test('throws configuration error when value is non-integer or float', () => {
    assert.throws(
      () => parsePositiveInt('12.34', 10, 'SIZE'),
      /Configuration error: SIZE must be a positive integer/
    );
  });

  test('throws configuration error when value is non-numeric string', () => {
    assert.throws(
      () => parsePositiveInt('invalid', 10, 'PORT'),
      /Configuration error: PORT must be a positive integer/
    );
    assert.throws(
      () => parsePositiveInt('abc', 10, 'LIMIT'),
      /Configuration error: LIMIT must be a positive integer/
    );
  });
});


describe('isOriginAllowed CORS decision logic', () => {
  const prodAllowed = ['https://repolens.vercel.app', 'https://repolens.com'];

  describe('Requests without Origin header', () => {
    test('allows requests with undefined Origin (e.g. curl, health checks)', () => {
      assert.equal(isOriginAllowed(undefined, prodAllowed, false), true);
      assert.equal(isOriginAllowed(undefined, [], false), true);
      assert.equal(isOriginAllowed(undefined, [], true), true);
    });

    test('allows requests with empty Origin string', () => {
      assert.equal(isOriginAllowed('', prodAllowed, false), true);
    });
  });

  describe('Development mode (isDev = true)', () => {
    test('allows standard Vite dev servers', () => {
      assert.equal(isOriginAllowed('http://localhost:5173', [], true), true);
      assert.equal(isOriginAllowed('http://127.0.0.1:5173', [], true), true);
      assert.equal(isOriginAllowed('http://localhost:4173', [], true), true);
      assert.equal(isOriginAllowed('http://localhost:3000', [], true), true);
    });

    test('allows arbitrary localhost ports in dev mode', () => {
      assert.equal(isOriginAllowed('http://localhost:8080', [], true), true);
      assert.equal(isOriginAllowed('http://127.0.0.1:9000', [], true), true);
    });

    test('allows origins explicitly in allowedOrigins list in dev mode', () => {
      assert.equal(isOriginAllowed('https://staging.repolens.com', ['https://staging.repolens.com'], true), true);
    });

    test('rejects external unauthorized origins in dev mode', () => {
      assert.equal(isOriginAllowed('https://evil.com', [], true), false);
      assert.equal(isOriginAllowed('https://github.com', [], true), false);
    });
  });

  describe('Production mode (isDev = false)', () => {
    test('allows only origins listed in allowedOrigins', () => {
      assert.equal(isOriginAllowed('https://repolens.vercel.app', prodAllowed, false), true);
      assert.equal(isOriginAllowed('https://repolens.com', prodAllowed, false), true);
    });

    test('rejects unlisted localhost origins in production', () => {
      assert.equal(isOriginAllowed('http://localhost:5173', prodAllowed, false), false);
      assert.equal(isOriginAllowed('http://127.0.0.1:5173', prodAllowed, false), false);
    });

    test('rejects unauthorized third-party origins in production', () => {
      assert.equal(isOriginAllowed('https://evil.com', prodAllowed, false), false);
      assert.equal(isOriginAllowed('https://repolens.vercel.app.evil.com', prodAllowed, false), false);
    });

    test('rejects all origins if allowedOrigins is empty in production', () => {
      assert.equal(isOriginAllowed('https://repolens.vercel.app', [], false), false);
    });
  });
});
