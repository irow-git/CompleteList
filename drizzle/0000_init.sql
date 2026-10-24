CREATE TABLE `game_metadata` (
	`game_id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `game_metadata_dirty_idx` ON `game_metadata` (`dirty`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`title` text NOT NULL,
	`completion` text NOT NULL,
	`release_date` text,
	`last_completion` text,
	`platform` text NOT NULL,
	`tags` text NOT NULL,
	`original_copy` integer DEFAULT false NOT NULL,
	`free_to_play` integer DEFAULT false NOT NULL,
	`service` integer DEFAULT false NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `games_parent_id_idx` ON `games` (`parent_id`);