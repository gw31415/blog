import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";

export function testDatabase() {
  const sql = new DatabaseSync(":memory:");
  sql.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .toSorted())
    sql.exec(readFileSync(`migrations/${file}`, "utf8"));
  class Statement {
    constructor(
      public query: string,
      public args: SQLInputValue[] = [],
    ) {}
    bind(...args: SQLInputValue[]) {
      return new Statement(this.query, args);
    }
    async first() {
      return sql.prepare(this.query).get(...this.args) ?? null;
    }
    async all() {
      return { results: sql.prepare(this.query).all(...this.args) };
    }
    async run() {
      return { meta: { changes: Number(sql.prepare(this.query).run(...this.args).changes) } };
    }
  }
  const adapter = {
    prepare: (query: string) => new Statement(query),
    async batch(statements: Statement[]) {
      sql.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sql.exec("COMMIT");
        return results;
      } catch (error) {
        sql.exec("ROLLBACK");
        throw error;
      }
    },
  };
  // Real transactional SQLite with the subset of D1 used by these tests.
  // eslint-disable-next-line typescript/no-unsafe-type-assertion
  return { sql, db: adapter as unknown as D1Database };
}
