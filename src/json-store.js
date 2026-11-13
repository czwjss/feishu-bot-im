/** Small transactional JSON store: publish memory only after an atomic write. */
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { KeyedQueue } from './queue.js';

export async function readJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (cause) {
    if (cause.code === 'ENOENT') return null;
    throw Object.assign(new Error(`无法读取 JSON 文件：${path}`, { cause }), { code: cause.code ?? 'INVALID_JSON' });
  }
}

export async function writePrivateJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

export const definedFields = (value) => Object.fromEntries(
  Object.entries(value ?? {}).filter(([, item]) => item !== undefined),
);

export class JsonStore {
  #path;
  #normalize;
  #value;
  #writes = new KeyedQueue();
  #loadError = null;

  constructor(path, normalize) {
    if (typeof path !== 'string' || !path) throw new TypeError('JsonStore 需要 path');
    this.#path = path;
    this.#normalize = normalize;
    this.#value = normalize(null);
  }

  get value() { return this.#value; }

  load(migrate = (value) => value) {
    return this.#writes.run('document', async () => {
      try {
        const raw = await readJson(this.#path);
        const migrated = migrate(raw);
        const next = this.#normalize(migrated);
        if (migrated !== raw) await writePrivateJson(this.#path, next);
        this.#value = next;
        this.#loadError = null;
        return next;
      } catch (error) {
        this.#loadError = error;
        throw error;
      }
    });
  }

  update(updater) {
    return this.#writes.run('document', async () => {
      if (this.#loadError) throw this.#loadError;
      const value = updater(this.#value);
      if (value === this.#value) return this.#value;
      const next = this.#normalize(value);
      await writePrivateJson(this.#path, next);
      this.#value = next;
      return next;
    });
  }

  clear() {
    return this.#writes.run('document', async () => {
      await rm(this.#path, { force: true });
      this.#value = this.#normalize(null);
      this.#loadError = null;
    });
  }
}
