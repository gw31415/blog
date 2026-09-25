// No TTL: a history entry can survive tab suspension or a browser restart.
// IndexedDB avoids duplicating large lists in history.state or Web Storage.
async function openCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("blog-post-list", 1);
    request.addEventListener("upgradeneeded", () => request.result.createObjectStore("entries"));
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
    request.addEventListener("blocked", () => reject(new Error("Cache database blocked")), {
      once: true,
    });
  });
}

export async function readPostListCache<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openCache();
    try {
      return await new Promise<T | undefined>((resolve, reject) => {
        const request = db.transaction("entries").objectStore("entries").get(key);
        request.addEventListener("success", () => resolve(request.result), { once: true });
        request.addEventListener("error", () => reject(request.error), { once: true });
      });
    } finally {
      db.close();
    }
  } catch {
    return undefined;
  }
}

export async function writePostListCache(key: string, value: unknown): Promise<void> {
  try {
    const db = await openCache();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("entries", "readwrite");
        transaction.objectStore("entries").put(value, key);
        transaction.addEventListener("complete", () => resolve(), { once: true });
        transaction.addEventListener("error", () => reject(transaction.error), { once: true });
        transaction.addEventListener("abort", () => reject(transaction.error), { once: true });
      });
    } finally {
      db.close();
    }
  } catch {
    /* Browser storage can be unavailable; the session copy still works. */
  }
}
