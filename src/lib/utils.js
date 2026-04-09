/**
 * Throttle a function to execute at most once per `limit` ms.
 * @param {Function} func
 * @param {number} limit - milliseconds
 * @returns {Function}
 */
export const throttle = (func, limit) => {
  let lastCall = 0;
  return function (...args) {
    const now = performance.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      func.apply(this, args);
    }
  };
};
