CREATE TABLE `itinerary` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`regionId` text NOT NULL,
	`title` text NOT NULL,
	`style` text NOT NULL,
	`dayCount` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`regionId`) REFERENCES `region`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_itinerary_user_updated` ON `itinerary` (`userId`,`updatedAt`);--> statement-breakpoint
CREATE TABLE `itineraryItem` (
	`id` text PRIMARY KEY NOT NULL,
	`itineraryId` text NOT NULL,
	`placeId` text NOT NULL,
	`dayNumber` integer NOT NULL,
	`position` integer NOT NULL,
	`scheduledTime` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`itineraryId`) REFERENCES `itinerary`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`placeId`) REFERENCES `place`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `itinerary_item_slot_unique` ON `itineraryItem` (`itineraryId`,`dayNumber`,`position`);--> statement-breakpoint
CREATE INDEX `idx_itinerary_item_itinerary` ON `itineraryItem` (`itineraryId`);--> statement-breakpoint
CREATE TABLE `place` (
	`id` text PRIMARY KEY NOT NULL,
	`regionId` text NOT NULL,
	`dayGroup` integer NOT NULL,
	`sortOrder` integer NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`suggestedTime` text NOT NULL,
	`durationMinutes` integer NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`styleTags` text NOT NULL,
	FOREIGN KEY (`regionId`) REFERENCES `region`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_place_region_day_order` ON `place` (`regionId`,`dayGroup`,`sortOrder`);--> statement-breakpoint
CREATE TABLE `region` (
	`id` text PRIMARY KEY NOT NULL,
	`nameKo` text NOT NULL,
	`nameEn` text NOT NULL,
	`nameJp` text NOT NULL,
	`eyebrow` text NOT NULL,
	`headline` text NOT NULL,
	`intro` text NOT NULL,
	`tipTitle` text NOT NULL,
	`tipText` text NOT NULL,
	`centerLat` real NOT NULL,
	`centerLon` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `userPreference` (
	`userId` text PRIMARY KEY NOT NULL,
	`preferredStyle` text DEFAULT 'balanced' NOT NULL,
	`lastRegionId` text,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lastRegionId`) REFERENCES `region`(`id`) ON UPDATE no action ON DELETE set null
);
