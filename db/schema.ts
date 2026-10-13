import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const inquiries = sqliteTable('inquiries', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  message: text('message').notNull(),
  source: text('source').notNull(),
  createdAt: text('created_at').notNull()
});
