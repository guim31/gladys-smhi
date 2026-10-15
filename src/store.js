// -----------------------------------------------------------------------------
// What survives a restart, under /data (the only writable volume): the
// warnings already announced to the scenes, so a restart does not fire the
// "new warning" trigger again for a warning in progress. Nothing secret.
// -----------------------------------------------------------------------------

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export class Store {
  /** @param {string} [dir] */
  constructor(dir = '/data') {
    this.path = join(dir, 'smhi-state.json');
    this.dir = dir;
  }

  /** @returns {Promise<{ announced: Record<string, string[]> }>} */
  async load() {
    try {
      const data = JSON.parse(await readFile(this.path, 'utf8'));
      return {
        announced: data?.announced && typeof data.announced === 'object' ? data.announced : {},
      };
    } catch {
      return { announced: {} };
    }
  }

  /** @param {{ announced: Record<string, string[]> }} data */
  async save(data) {
    await mkdir(this.dir, { recursive: true });
    const temporary = `${this.path}.tmp`;
    await writeFile(temporary, JSON.stringify(data));
    await rename(temporary, this.path);
  }
}
