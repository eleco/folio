import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const links = sqliteTable('links', { id:text('id').primaryKey(), userId:text('user_id').notNull(), url:text('url').notNull(), title:text('title').notNull(), createdAt:integer('created_at').notNull(), archived:integer('archived').notNull().default(0) }, t => [uniqueIndex('user_url').on(t.userId,t.url)]);
