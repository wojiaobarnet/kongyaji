import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const inquiries = sqliteTable('inquiries', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  message: text('message').notNull(),
  source: text('source').notNull(),
  createdAt: text('created_at').notNull(),
  status: text('status').notNull().default('new'),
  note: text('note').notNull().default(''),
  updatedAt: text('updated_at')
});
export const cmsDocuments = sqliteTable('cms_documents', {
  id: text('id').primaryKey(),
  draftJson: text('draft_json').notNull().default(''),
  publishedJson: text('published_json').notNull().default(''),
  revision: integer('revision').notNull().default(0),
  publishedRevision: integer('published_revision').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});
export const cmsRevisions = sqliteTable('cms_revisions', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull(),
  revision: integer('revision').notNull(),
  documentJson: text('document_json').notNull(),
  createdAt: text('created_at').notNull()
},table=>[uniqueIndex('cms_revision_document_version').on(table.documentId,table.revision)]);
export const cmsMedia = sqliteTable('cms_media', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  key: text('key').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  createdAt: text('created_at').notNull()
});
