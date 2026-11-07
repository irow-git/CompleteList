CREATE TABLE `select_items` (
	`id` text PRIMARY KEY NOT NULL,
	`list` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `select_items_list_idx` ON `select_items` (`list`);--> statement-breakpoint
CREATE INDEX `select_items_dirty_idx` ON `select_items` (`dirty`);