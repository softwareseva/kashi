/** All SQL for the example table. Rows are aliased to camelCase so they match the contract. */
import { newId, nowIso } from "@softwareseva/core/server";

export type ExampleRow = { id: string; title: string; createdAt: string; updatedAt: string };
const columns = "id, title, created_at AS createdAt, updated_at AS updatedAt";

export class ExampleRepository {
  constructor(private readonly db: D1Database) {}

  get(id: string): Promise<ExampleRow | null> {
    return this.db.prepare(`SELECT ${columns} FROM examples WHERE id = ? AND deleted_at IS NULL`).bind(id).first<ExampleRow>();
  }

  async create(input: { title: string }): Promise<ExampleRow> {
    const id = newId("ex"); const now = nowIso();
    await this.db.prepare("INSERT INTO examples(id, title, created_at, updated_at) VALUES (?, ?, ?, ?)").bind(id, input.title, now, now).run();
    return { id, title: input.title, createdAt: now, updatedAt: now };
  }
}
