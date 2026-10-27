import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFrameworks } from './frameworks.js';

describe('normalizeFrameworks', () => {
  it('returns empty array when input is null, undefined, or empty', () => {
    assert.deepEqual(normalizeFrameworks(null), []);
    assert.deepEqual(normalizeFrameworks(undefined), []);
    assert.deepEqual(normalizeFrameworks([]), []);
    assert.deepEqual(normalizeFrameworks({}), []);
  });

  it('normalizes real backend array format [{ name, evidencePath }]', () => {
    const rawBackendArray = [
      { name: 'express', evidencePath: 'backend/package.json' },
      { name: 'mongoose', evidencePath: 'backend/package.json' },
      { name: 'react', evidencePath: 'frontend/package.json' },
      { name: 'vite', evidencePath: 'frontend/package.json' },
      { name: 'vite', evidencePath: 'frontend/vite.config.js' },
    ];

    const normalized = normalizeFrameworks(rawBackendArray);

    assert.equal(normalized.length, 5);
    assert.deepEqual(normalized[0], {
      name: 'express',
      evidence: 'backend/package.json',
      key: 'express-0',
    });
    assert.deepEqual(normalized[2], {
      name: 'react',
      evidence: 'frontend/package.json',
      key: 'react-2',
    });
    assert.deepEqual(normalized[4], {
      name: 'vite',
      evidence: 'frontend/vite.config.js',
      key: 'vite-4',
    });
  });

  it('handles fallback legacy object format', () => {
    const rawObject = {
      react: { evidence: 'package.json' },
      vite: { evidencePath: 'vite.config.js' },
    };

    const normalized = normalizeFrameworks(rawObject);
    assert.equal(normalized.length, 2);
    assert.deepEqual(normalized[0], {
      name: 'react',
      evidence: 'package.json',
      key: 'react',
    });
    assert.deepEqual(normalized[1], {
      name: 'vite',
      evidence: 'vite.config.js',
      key: 'vite',
    });
  });

  it('handles string array elements gracefully', () => {
    const list = ['react', 'tailwindcss'];
    const normalized = normalizeFrameworks(list);
    assert.equal(normalized.length, 2);
    assert.equal(normalized[0].name, 'react');
    assert.equal(normalized[0].evidence, 'package.json');
  });
});
