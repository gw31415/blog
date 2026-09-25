// No TTL: a history entry can survive tab suspension or a browser restart.
// IndexedDB avoids duplicating large lists in history.state or Web Storage.
async function openCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("blog-post-list", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("entries");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Cache database blocked"));
  });
}

export async function readPostListCache<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openCache();
    try {
      return await new Promise<T | undefined>((resolve, reject) => {
        const request = db.transaction("entries").objectStore("entries").get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
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
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      db.close();
    }
  } catch {
    /* Browser storage can be unavailable; the session copy still works. */
  }
}
