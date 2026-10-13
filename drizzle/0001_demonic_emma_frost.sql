CREATE TABLE `cms_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_json` text DEFAULT '' NOT NULL,
	`published_json` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`published_revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cms_media` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`key` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cms_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`revision` integer NOT NULL,
	`document_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cms_revision_document_version` ON `cms_revisions` (`document_id`,`revision`);--> statement-breakpoint
ALTER TABLE `inquiries` ADD `status` text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE `inquiries` ADD `note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `inquiries` ADD `updated_at` text;