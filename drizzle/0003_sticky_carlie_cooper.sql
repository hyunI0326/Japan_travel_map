CREATE TABLE IF NOT EXISTS `itineraryPlan` (
	`itineraryId` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	FOREIGN KEY (`itineraryId`) REFERENCES `itinerary`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tripDiscussion` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`userId` text NOT NULL,
	`author` text NOT NULL,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`slug`) REFERENCES `sharedTrip`(`slug`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `trip_discussion_slug` ON `tripDiscussion` (`slug`,`createdAt`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tripVote` (
	`discussionId` text NOT NULL,
	`userId` text NOT NULL,
	FOREIGN KEY (`discussionId`) REFERENCES `tripDiscussion`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `trip_vote_unique` ON `tripVote` (`discussionId`,`userId`);