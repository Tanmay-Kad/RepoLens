import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseAndValidateRepoUrl } from './repoUrlInput.js';

describe('repoUrlInput', () => {
  describe('accepted valid URLs', () => {
    it('accepts standard https URL', () => {
      const res = parseAndValidateRepoUrl('https://github.com/expressjs/express');
      assert.equal(res.isValid, true);
      assert.equal(res.owner, 'expressjs');
      assert.equal(res.repo, 'express');
      assert.equal(res.normalizedUrl, 'https://github.com/expressjs/express');
      assert.equal(res.error, null);
    });

    it('accepts URL with .git suffix', () => {
      const res = parseAndValidateRepoUrl('https://github.com/sindresorhus/is-stream.git');
      assert.equal(res.isValid, true);
      assert.equal(res.repo, 'is-stream');
      assert.equal(res.normalizedUrl, 'https://github.com/sindresorhus/is-stream');
    });

    it('accepts URL with trailing slash', () => {
      const res = parseAndValidateRepoUrl('https://github.com/facebook/react/');
      assert.equal(res.isValid, true);
      assert.equal(res.owner, 'facebook');
      assert.equal(res.repo, 'react');
      assert.equal(res.normalizedUrl, 'https://github.com/facebook/react');
    });

    it('accepts URL with subpaths like /tree/main/src', () => {
      const res = parseAndValidateRepoUrl('https://github.com/facebook/react/tree/main/packages/react');
      assert.equal(res.isValid, true);
      assert.equal(res.normalizedUrl, 'https://github.com/facebook/react');
    });

    it('accepts input without scheme like github.com/owner/repo', () => {
      const res = parseAndValidateRepoUrl('github.com/expressjs/express');
      assert.equal(res.isValid, true);
      assert.equal(res.owner, 'expressjs');
      assert.equal(res.repo, 'express');
      assert.equal(res.normalizedUrl, 'https://github.com/expressjs/express');
    });
  });

  describe('rejected invalid URLs', () => {
    it('rejects empty or whitespace input', () => {
      assert.equal(parseAndValidateRepoUrl('').isValid, false);
      assert.equal(parseAndValidateRepoUrl('   ').isValid, false);
      assert.equal(parseAndValidateRepoUrl(null).isValid, false);
    });

    it('rejects ssh:// and git@ schemes', () => {
      assert.equal(parseAndValidateRepoUrl('ssh://git@github.com/owner/repo').isValid, false);
      assert.equal(parseAndValidateRepoUrl('git@github.com:owner/repo.git').isValid, false);
    });

    it('rejects http: (only HTTPS allowed)', () => {
      const res = parseAndValidateRepoUrl('http://github.com/owner/repo');
      assert.equal(res.isValid, false);
      assert.match(res.error, /HTTPS/);
    });

    it('rejects evil domains: evilgithub.com and github.com.evil.com', () => {
      const evil1 = parseAndValidateRepoUrl('https://evilgithub.com/owner/repo');
      assert.equal(evil1.isValid, false);
      assert.match(evil1.error, /Only github\.com/);

      const evil2 = parseAndValidateRepoUrl('https://github.com.evil.com/owner/repo');
      assert.equal(evil2.isValid, false);
      assert.match(evil2.error, /Only github\.com/);
    });

    it('rejects embedded credentials', () => {
      const res = parseAndValidateRepoUrl('https://user:password@github.com/owner/repo');
      assert.equal(res.isValid, false);
      assert.match(res.error, /credentials/);
    });

    it('rejects custom ports', () => {
      const res = parseAndValidateRepoUrl('https://github.com:8443/owner/repo');
      assert.equal(res.isValid, false);
      assert.match(res.error, /Custom ports/);
    });

    it('rejects flags or command injection attempts', () => {
      assert.equal(parseAndValidateRepoUrl('--flag').isValid, false);
      assert.equal(parseAndValidateRepoUrl('https://github.com/-owner/repo').isValid, false);
      assert.equal(parseAndValidateRepoUrl('https://github.com/owner/-repo').isValid, false);
    });

    it('rejects dots and path traversal', () => {
      assert.equal(parseAndValidateRepoUrl('https://github.com/../repo').isValid, false);
      assert.equal(parseAndValidateRepoUrl('https://github.com/owner/..').isValid, false);
    });
  });
});
