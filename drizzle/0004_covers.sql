CREATE TABLE `covers` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`image` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `covers_game_id_idx` ON `covers` (`game_id`);--> statement-breakpoint
CREATE INDEX `covers_dirty_idx` ON `covers` (`dirty`);