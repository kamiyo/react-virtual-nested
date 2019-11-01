const debounce = function(fn: (...args: any[]) => void) {
  let timeout = null;
  return function(this: any, ...args: any[]) {
    const context = this;
    if (timeout) {
      window.cancelAnimationFrame(timeout);
    }

    timeout = window.requestAnimationFrame(function() {
      fn.apply(context, args);
      timeout = null;
    });
  };
};

export default debounce;
