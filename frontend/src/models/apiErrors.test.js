import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapApiError } from './apiErrors.js';

describe('apiErrors', () => {
  it('maps network error to friendly unreachable message', () => {
    const err = new Error('Network error. Ensure the server is running.');
    const mapped = mapApiError(err);
    assert.equal(mapped.status, 0);
    assert.equal(mapped.title, 'Backend Unreachable');
    assert.equal(mapped.isTransient, true);
    assert.match(mapped.hint, /running on port 5000/);
  });

  it('maps 400 invalid URL', () => {
    const mapped = mapApiError({ status: 400, message: 'Invalid URL format.' });
    assert.equal(mapped.status, 400);
    assert.equal(mapped.title, 'Invalid Repository URL');
    assert.match(mapped.hint, /github\.com/);
  });

  it('maps 404 repository not found', () => {
    const mapped = mapApiError({ status: 404, message: 'Repository not found or private.' });
    assert.equal(mapped.status, 404);
    assert.equal(mapped.title, 'Repository Not Found');
  });

  it('maps 408 and 504 to analysis timeout', () => {
    const m504 = mapApiError({ status: 504 });
    assert.equal(m504.status, 504);
    assert.equal(m504.title, 'Analysis Timed Out');
    assert.equal(m504.isTransient, true);

    const m408 = mapApiError({ status: 408 });
    assert.equal(m408.status, 408);
    assert.equal(m408.title, 'Analysis Timed Out');
  });

  it('maps 413 and 422 to repository limit exceeded', () => {
    const m413 = mapApiError({ status: 413 });
    assert.equal(m413.status, 413);
    assert.equal(m413.title, 'Repository Limit Exceeded');

    const m422 = mapApiError({ status: 422 });
    assert.equal(m422.status, 422);
    assert.equal(m422.title, 'Repository Limit Exceeded');
  });

  it('maps 429 rate limit with Retry-After', () => {
    const mapped = mapApiError({ status: 429, retryAfter: 45 });
    assert.equal(mapped.status, 429);
    assert.equal(mapped.title, 'Rate Limit Reached');
    assert.equal(mapped.retryAfter, 45);
    assert.match(mapped.hint, /45 seconds/);
  });

  it('maps 503 service busy with Retry-After', () => {
    const mapped = mapApiError({ status: 503, retryAfter: 15 });
    assert.equal(mapped.status, 503);
    assert.equal(mapped.title, 'Service Busy');
    assert.equal(mapped.retryAfter, 15);
    assert.match(mapped.hint, /15 seconds/);
  });
});
