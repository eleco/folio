import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const links = sqliteTable('links', { id:text('id').primaryKey(), userId:text('user_id').notNull(), url:text('url').notNull(), title:text('title').notNull(), createdAt:integer('created_at').notNull(), archived:integer('archived').notNull().default(0) }, t => [uniqueIndex('user_url').on(t.userId,t.url)]);
export const articles = sqliteTable('articles', {url:text('url').primaryKey(),title:text('title').notNull()});
export const shares = sqliteTable('shares', {
 linkId:text('link_id').primaryKey().references(()=>links.id,{onDelete:'cascade'}),
 userId:text('user_id').notNull(),
 articleUrl:text('article_url').notNull().references(()=>articles.url),
 sharedAt:integer('shared_at').notNull()
}, t=>[uniqueIndex('share_user_article').on(t.userId,t.articleUrl)]);
