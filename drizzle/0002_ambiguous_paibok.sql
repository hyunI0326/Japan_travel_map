CREATE TABLE `analyticsDaily` (
	`date` text NOT NULL,
	`event` text NOT NULL,
	`regionId` text DEFAULT '' NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analytics_daily_event_region_unique` ON `analyticsDaily` (`date`,`event`,`regionId`);--> statement-breakpoint
CREATE INDEX `idx_analytics_daily_date` ON `analyticsDaily` (`date`);--> statement-breakpoint
CREATE TABLE `sharedTrip` (
	`slug` text PRIMARY KEY NOT NULL,
	`regionId` text NOT NULL,
	`title` text NOT NULL,
	`payload` text NOT NULL,
	`placeCount` integer NOT NULL,
	`dayCount` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`regionId`) REFERENCES `region`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_shared_trip_created_at` ON `sharedTrip` (`createdAt`);