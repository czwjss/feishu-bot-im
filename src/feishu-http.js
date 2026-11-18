import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * The SDK's generated endpoints discard `signal` in request options. Carry it
 * through the async call instead, including token acquisition and multipart
 * upload. Each concurrent operation keeps its own cancellation scope.
 */
export function abortableSdkTransport(base) {
  const requests = new AsyncLocalStorage();
  const request = async (options) => {
    const current = requests.getStore();
    const signal = current && options.signal ? AbortSignal.any([current, options.signal]) : current ?? options.signal;
    signal?.throwIfAborted();
    return base.request({ ...options, ...(signal ? { signal } : {}) });
  };
  return {
    httpInstance: {
      ...base,
      request,
      // The token manager uses post directly rather than request.
      post: (url, data, options) => request({ ...options, method: 'post', url, data }),
    },
    async run(signal, operation) {
      signal?.throwIfAborted();
      return requests.run(signal, operation);
    },
  };
}
