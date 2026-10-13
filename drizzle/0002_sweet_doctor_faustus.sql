ALTER TABLE `cms_media` ADD `width` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `cms_media` ADD `height` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `cms_media` ADD `purpose` text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE `cms_media` ADD `hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `cms_media_hash` ON `cms_media` (`hash`);