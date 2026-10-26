/**
 * Simple in-process concurrency limiter (semaphore).
 */
export class Semaphore {
  constructor(maxConcurrency = 2) {
    if (typeof maxConcurrency !== 'number' || maxConcurrency <= 0) {
      throw new Error('Semaphore maxConcurrency must be a positive integer');
    }
    this.max = maxConcurrency;
    this.current = 0;
  }

  /**
   * Attempts to acquire a slot immediately.
   * @returns {boolean} True if acquired, false if saturated.
   */
  tryAcquire() {
    if (this.current >= this.max) {
      return false;
    }
    this.current++;
    return true;
  }

  /**
   * Releases an acquired slot.
   */
  release() {
    if (this.current > 0) {
      this.current--;
    }
  }

  get activeCount() {
    return this.current;
  }

  get isSaturated() {
    return this.current >= this.max;
  }
}

export default Semaphore;
