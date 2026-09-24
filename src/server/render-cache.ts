import { type RenderEntry, type RenderResult } from "../content/render-contract";

export type RenderProducer = (entries: RenderEntry[]) => Promise<RenderResult[]>;
const ready = (row: RenderResult | null): row is RenderResult =>
  !!row && (row.output !== null || row.diagnostic !== null);

export async function resolveRenderCache(
  db: D1Database,
  inputs: RenderEntry[],
  produce: RenderProducer,
  post?: { id: string; body: string },
): Promise<Map<string, RenderResult>> {
  const entries = [...new Map(inputs.map((entry) => [entry.key, entry])).values()];
  const result = new Map<string, RenderResult>();
  if (!entries.length) return result;
  const read = async (keys: string[]) => {
    if (!keys.length) return [];
    const { results } = await db
      .prepare(`SELECT c.key, c.output, c.diagnostic, ${post ? "ref.cache_key" : "NULL"} AS reference
      FROM json_each(?) requested JOIN render_cache c ON c.key=requested.value
      ${post ? "LEFT JOIN post_render_refs ref ON ref.cache_key=c.key AND ref.post_id=?" : ""}`)
      .bind(JSON.stringify(keys), ...(post ? [post.id] : []))
      .all<RenderResult & { key: string; reference: string | null }>();
    return results;
  };
  const rows = await read(entries.map((entry) => entry.key));
  for (const row of rows)
    if (ready(row)) result.set(row.key, { output: row.output, diagnostic: row.diagnostic });
  if (post && (rows.length !== entries.length || rows.some((row) => !row.reference)))
    await db.batch(syncRenderReferences(db, post, entries));
  const missing = entries.filter((entry) => !result.has(entry.key));
  if (!missing.length) return result;
  const owner = crypto.randomUUID();
  const now = Date.now();
  // Only the lease expires. Completed output has no TTL.
  const claims = await db
    .prepare(`
    INSERT INTO render_cache(key,kind,source,renderer,owner,lease_until)
    SELECT json_extract(value,'$.key'),json_extract(value,'$.kind'),json_extract(value,'$.source'),json_extract(value,'$.renderer'),?,?
    FROM json_each(?) requested WHERE true
    ${post ? "AND EXISTS(SELECT 1 FROM post_render_refs ref WHERE ref.post_id=? AND ref.cache_key=json_extract(requested.value,'$.key'))" : ""}
    ON CONFLICT(key) DO UPDATE SET owner=excluded.owner,lease_until=excluded.lease_until
    WHERE render_cache.output IS NULL AND render_cache.diagnostic IS NULL AND render_cache.lease_until < ?
    RETURNING key`)
    .bind(owner, now + 90000, JSON.stringify(missing), ...(post ? [post.id] : []), now)
    .all<{ key: string }>();
  const claimed = new Set(claims.results.map((row) => row.key));
  const owned = missing.filter((entry) => claimed.has(entry.key));
  if (owned.length) {
    try {
      const outputs = await produce(owned);
      if (outputs.length !== owned.length || outputs.some((output) => !ready(output)))
        throw new Error("Incomplete render result");
      await db.batch(
        owned.map((entry, index) =>
          db
            .prepare(
              `UPDATE render_cache SET output=?,diagnostic=?,owner=NULL,lease_until=0 WHERE key=? AND owner=?`,
            )
            .bind(outputs[index].output, outputs[index].diagnostic, entry.key, owner),
        ),
      );
      owned.forEach((entry, index) => result.set(entry.key, outputs[index]));
    } catch (error) {
      await db.batch(
        owned.map((entry) =>
          db
            .prepare("UPDATE render_cache SET owner=NULL,lease_until=0 WHERE key=? AND owner=?")
            .bind(entry.key, owner),
        ),
      );
      throw error;
    }
  }
  let waiting = missing.filter((entry) => !result.has(entry.key));
  const deadline = Date.now() + 45000;
  while (waiting.length) {
    const rows = await read(waiting.map((entry) => entry.key));
    for (const row of rows)
      if (ready(row)) result.set(row.key, { output: row.output, diagnostic: row.diagnostic });
    waiting = waiting.filter((entry) => !result.has(entry.key));
    if (!waiting.length) break;
    if (Date.now() >= deadline)
      throw new Error("図の生成を処理中です。しばらくしてから再読込してください。");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return result;
}

export function insertRenderCache(
  db: D1Database,
  entry: RenderEntry,
  output: string,
  post?: { id: string; body: string },
): D1PreparedStatement {
  return db
    .prepare(`INSERT INTO render_cache(key,kind,source,renderer,output) SELECT ?,?,?,?,? ${post ? "WHERE EXISTS(SELECT 1 FROM posts WHERE id=? AND body_json=?)" : ""}
    ON CONFLICT(key) DO UPDATE SET output=excluded.output,diagnostic=NULL,owner=NULL,lease_until=0
    WHERE render_cache.output IS NULL`)
    .bind(
      entry.key,
      entry.kind,
      entry.source,
      entry.renderer,
      output,
      ...(post ? [post.id, post.body] : []),
    );
}

// Add new references before removing old ones. Unchanged entries are never deleted,
// so the database's orphan-cleanup trigger cannot evict their cached output.
export function syncRenderReferences(
  db: D1Database,
  post: { id: string; body: string },
  entries: RenderEntry[],
): D1PreparedStatement[] {
  const payload = JSON.stringify([...new Map(entries.map((entry) => [entry.key, entry])).values()]);
  const guard = "EXISTS(SELECT 1 FROM posts WHERE id=? AND body_json=?)";
  return [
    db
      .prepare(`INSERT INTO render_cache(key,kind,source,renderer)
      SELECT json_extract(value,'$.key'),json_extract(value,'$.kind'),json_extract(value,'$.source'),json_extract(value,'$.renderer')
      FROM json_each(?) WHERE ${guard} ON CONFLICT(key) DO NOTHING`)
      .bind(payload, post.id, post.body),
    db
      .prepare(`INSERT INTO post_render_refs(post_id,cache_key)
      SELECT ?,json_extract(value,'$.key') FROM json_each(?) WHERE ${guard}
      ON CONFLICT(post_id,cache_key) DO NOTHING`)
      .bind(post.id, payload, post.id, post.body),
    db
      .prepare(`DELETE FROM post_render_refs WHERE post_id=? AND ${guard}
      AND cache_key NOT IN (SELECT json_extract(value,'$.key') FROM json_each(?))`)
      .bind(post.id, post.id, post.body, payload),
  ];
}
