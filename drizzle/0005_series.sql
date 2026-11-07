ALTER TABLE `games` ADD `series` text;--> statement-breakpoint
CREATE INDEX `games_series_idx` ON `games` (`series`);