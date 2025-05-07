// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { sql } from "drizzle-orm";
import  {createId}  from '@paralleldrive/cuid2';
import { index, pgEnum, pgTableCreator } from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `taskmanager_${name}`);

export const posts = createTable(
  "post",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 256 }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [index("name_idx").on(t.name)],
);

export const taskStatusEnum = pgEnum('task_status',['pending','in-progress','completed'])
export const tasks = createTable('task',(d)=>({
  id: d.varchar('id').primaryKey().default(() => createId()), // CUID

  title: d.varchar('title',{length:255}).notNull(),
  description:d.text('description'),
  status:taskStatusEnum('status').default('pending').notNull(),
  createdAt:d.timestamp('created_at').defaultNow().notNull(),
  imageUrl:d.text('image_url')


}))


export type Task = typeof tasks.$inferSelect;