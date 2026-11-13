/** Serialize work for one key without blocking unrelated keys or retaining idle queues. */
export class KeyedQueue {
  #tails = new Map();

  run(key, task) {
    const result = (this.#tails.get(key) ?? Promise.resolve()).then(task);
    const tail = result.catch(() => undefined).finally(() => {
      if (this.#tails.get(key) === tail) this.#tails.delete(key);
    });
    this.#tails.set(key, tail);
    return result;
  }
}
