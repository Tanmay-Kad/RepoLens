import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Semaphore } from './semaphore.js';

describe('Semaphore Concurrency Limiter', () => {
  test('initializes with positive max concurrency', () => {
    const sem = new Semaphore(2);
    assert.equal(sem.max, 2);
    assert.equal(sem.activeCount, 0);
    assert.equal(sem.isSaturated, false);
  });

  test('throws when initialized with zero or negative number', () => {
    assert.throws(() => new Semaphore(0), /positive integer/);
    assert.throws(() => new Semaphore(-1), /positive integer/);
    assert.throws(() => new Semaphore('2'), /positive integer/);
  });

  test('allows acquisitions up to maximum concurrency', () => {
    const sem = new Semaphore(2);
    assert.equal(sem.tryAcquire(), true);
    assert.equal(sem.activeCount, 1);
    assert.equal(sem.isSaturated, false);

    assert.equal(sem.tryAcquire(), true);
    assert.equal(sem.activeCount, 2);
    assert.equal(sem.isSaturated, true);
  });

  test('rejects acquisition when saturated (returns false)', () => {
    const sem = new Semaphore(2);
    assert.equal(sem.tryAcquire(), true);
    assert.equal(sem.tryAcquire(), true);

    // Third concurrent request is rejected
    assert.equal(sem.tryAcquire(), false);
    assert.equal(sem.activeCount, 2);
    assert.equal(sem.isSaturated, true);
  });

  test('frees slots upon release and allows subsequent acquisitions', () => {
    const sem = new Semaphore(2);
    sem.tryAcquire();
    sem.tryAcquire();
    assert.equal(sem.isSaturated, true);

    // Release one slot
    sem.release();
    assert.equal(sem.activeCount, 1);
    assert.equal(sem.isSaturated, false);

    // Next acquisition succeeds
    assert.equal(sem.tryAcquire(), true);
    assert.equal(sem.activeCount, 2);
    assert.equal(sem.isSaturated, true);
  });

  test('does not drop activeCount below zero on extra releases', () => {
    const sem = new Semaphore(1);
    sem.release();
    assert.equal(sem.activeCount, 0);

    sem.tryAcquire();
    sem.release();
    sem.release();
    assert.equal(sem.activeCount, 0);
  });
});
