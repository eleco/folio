CREATE TABLE `articles` (
	`url` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shares` (
	`link_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`article_url` text NOT NULL,
	`shared_at` integer NOT NULL,
	FOREIGN KEY (`link_id`) REFERENCES `links`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`article_url`) REFERENCES `articles`(`url`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_user_article` ON `shares` (`user_id`,`article_url`);