CREATE TABLE `sync_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer NOT NULL,
	`failed` integer NOT NULL,
	`warnings` integer NOT NULL,
	`local_changes` integer NOT NULL,
	`cloud_changes` integer NOT NULL,
	`report` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sync_reports_started_at_idx` ON `sync_reports` (`started_at`);