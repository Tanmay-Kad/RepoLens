import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseGitHubUrl } from './githubUrl.js';

describe('parseGitHubUrl', () => {
  describe('Valid GitHub URLs', () => {
    test('accepts standard plain https repository URL', () => {
      const result = parseGitHubUrl('https://github.com/Tanmay-Kad/RepoLens');
      assert.equal(result.isValid, true);
      assert.equal(result.owner, 'Tanmay-Kad');
      assert.equal(result.repo, 'RepoLens');
      assert.equal(result.normalizedUrl, 'https://github.com/Tanmay-Kad/RepoLens');
    });

    test('accepts repository URL with .git suffix and normalizes it', () => {
      const result = parseGitHubUrl('https://github.com/expressjs/express.git');
      assert.equal(result.isValid, true);
      assert.equal(result.owner, 'expressjs');
      assert.equal(result.repo, 'express');
      assert.equal(result.normalizedUrl, 'https://github.com/expressjs/express');
    });

    test('accepts repository URL with trailing slash and normalizes it', () => {
      const result = parseGitHubUrl('https://github.com/facebook/react/');
      assert.equal(result.isValid, true);
      assert.equal(result.owner, 'facebook');
      assert.equal(result.repo, 'react');
      assert.equal(result.normalizedUrl, 'https://github.com/facebook/react');
    });

    test('accepts URL with /tree/branch/subpath and ignores extra path segments', () => {
      const result = parseGitHubUrl('https://github.com/vercel/next.js/tree/canary/packages/next');
      assert.equal(result.isValid, true);
      assert.equal(result.owner, 'vercel');
      assert.equal(result.repo, 'next.js');
      assert.equal(result.normalizedUrl, 'https://github.com/vercel/next.js');
    });

    test('accepts mixed-case host and normalizes it', () => {
      const result = parseGitHubUrl('https://GITHUB.COM/owner/Repo-Name');
      assert.equal(result.isValid, true);
      assert.equal(result.owner, 'owner');
      assert.equal(result.repo, 'Repo-Name');
      assert.equal(result.normalizedUrl, 'https://github.com/owner/Repo-Name');
    });

    test('accepts names with periods, underscores, and hyphens', () => {
      const result = parseGitHubUrl('https://github.com/my_org.v2/sub-project.lib');
      assert.equal(result.isValid, true);
      assert.equal(result.owner, 'my_org.v2');
      assert.equal(result.repo, 'sub-project.lib');
      assert.equal(result.normalizedUrl, 'https://github.com/my_org.v2/sub-project.lib');
    });
  });

  describe('Rejected URLs and Attack Classes', () => {
    test('rejects lookalike host github.com.evil.com', () => {
      const result = parseGitHubUrl('https://github.com.evil.com/owner/repo');
      assert.equal(result.isValid, false);
      assert.match(result.error, /Only github\.com/);
    });

    test('rejects lookalike host evilgithub.com', () => {
      const result = parseGitHubUrl('https://evilgithub.com/owner/repo');
      assert.equal(result.isValid, false);
      assert.match(result.error, /Only github\.com/);
    });

    test('rejects non-GitHub hosts (e.g. gitlab.com)', () => {
      const result = parseGitHubUrl('https://gitlab.com/owner/repo');
      assert.equal(result.isValid, false);
      assert.match(result.error, /Only github\.com/);
    });

    test('rejects non-https schemes (http:)', () => {
      const result = parseGitHubUrl('http://github.com/owner/repo');
      assert.equal(result.isValid, false);
      assert.match(result.error, /Only secure HTTPS/);
    });

    test('rejects non-https schemes (git:)', () => {
      const result = parseGitHubUrl('git://github.com/owner/repo');
      assert.equal(result.isValid, false);
      assert.match(result.error, /Only secure HTTPS/);
    });

    test('rejects non-https schemes (ssh:)', () => {
      const result = parseGitHubUrl('ssh://git@github.com/owner/repo');
      assert.equal(result.isValid, false);
      assert.match(result.error, /Only secure HTTPS/);
    });

    test('rejects non-https schemes (file:)', () => {
      const result = parseGitHubUrl('file:///etc/passwd');
      assert.equal(result.isValid, false);
      assert.match(result.error, /Only secure HTTPS/);
    });

    test('rejects URLs with embedded credentials', () => {
      const result = parseGitHubUrl('https://user:password@github.com/owner/repo');
      assert.equal(result.isValid, false);
      assert.match(result.error, /credentials/i);
    });

    test('rejects URLs with custom ports', () => {
      const result = parseGitHubUrl('https://github.com:8443/owner/repo');
      assert.equal(result.isValid, false);
      assert.match(result.error, /port/i);
    });

    test('rejects segments with characters outside [A-Za-z0-9_.-]', () => {
      const result1 = parseGitHubUrl('https://github.com/own$er/repo');
      assert.equal(result1.isValid, false);
      assert.match(result1.error, /alphanumeric/i);

      const result2 = parseGitHubUrl('https://github.com/owner/repo;injection');
      assert.equal(result2.isValid, false);
      assert.match(result2.error, /alphanumeric/i);
    });

    test('rejects segments starting with a hyphen (flag injection defense)', () => {
      const result1 = parseGitHubUrl('https://github.com/-evilowner/repo');
      assert.equal(result1.isValid, false);
      assert.match(result1.error, /cannot start with a hyphen/i);

      const result2 = parseGitHubUrl('https://github.com/owner/--upload-pack=evil');
      assert.equal(result2.isValid, false);
      assert.match(result2.error, /cannot start with a hyphen/i);
    });

    test('rejects . and .. directory traversal segments', () => {
      const result1 = parseGitHubUrl('https://github.com/../repo');
      assert.equal(result1.isValid, false);

      const result2 = parseGitHubUrl('https://github.com/owner/..');
      assert.equal(result2.isValid, false);

      const result3 = parseGitHubUrl('https://github.com/./repo');
      assert.equal(result3.isValid, false);
    });

    test('rejects missing or empty owner/repo segments', () => {
      const result1 = parseGitHubUrl('https://github.com/');
      assert.equal(result1.isValid, false);

      const result2 = parseGitHubUrl('https://github.com/onlyowner');
      assert.equal(result2.isValid, false);
    });

    test('rejects over-long URLs', () => {
      const longRepo = 'a'.repeat(550);
      const result = parseGitHubUrl(`https://github.com/owner/${longRepo}`);
      assert.equal(result.isValid, false);
      assert.match(result.error, /maximum allowed length/i);
    });

    test('rejects null, undefined, and non-string inputs', () => {
      assert.equal(parseGitHubUrl(null).isValid, false);
      assert.equal(parseGitHubUrl(undefined).isValid, false);
      assert.equal(parseGitHubUrl('').isValid, false);
      assert.equal(parseGitHubUrl(12345).isValid, false);
    });
  });
});
