CREATE TABLE `signal_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`watchlistJson` text NOT NULL,
	`defaultTimeframe` varchar(16) NOT NULL DEFAULT '1h',
	`snrvEnabled` boolean NOT NULL DEFAULT true,
	`smcEnabled` boolean NOT NULL DEFAULT true,
	`snrvSwingLength` int NOT NULL DEFAULT 20,
	`snrvSensitivity` enum('Low','Medium','High') NOT NULL DEFAULT 'Medium',
	`minSignalScore` int NOT NULL DEFAULT 3,
	`atrStopMultiplier` decimal(8,3) NOT NULL DEFAULT '1.500',
	`rewardRiskRatio` decimal(8,3) NOT NULL DEFAULT '1.800',
	`maxAtrPct` decimal(8,5) NOT NULL DEFAULT '0.05000',
	`telegramEnabled` boolean NOT NULL DEFAULT false,
	`openRouterEnabled` boolean NOT NULL DEFAULT false,
	`scanEnabled` boolean NOT NULL DEFAULT false,
	`scanCron` varchar(64) NOT NULL DEFAULT '0 */15 * * * *',
	`schedule_cron_task_uid` varchar(65),
	`lastScanAt` timestamp,
	`lastScanStatus` enum('idle','healthy','warning','error') NOT NULL DEFAULT 'idle',
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `signal_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `signal_settings_ownerOpenId_unique` UNIQUE(`ownerOpenId`)
);
--> statement-breakpoint
CREATE TABLE `signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`source` enum('manual','scheduled') NOT NULL,
	`symbol` varchar(32) NOT NULL,
	`timeframe` varchar(16) NOT NULL,
	`direction` enum('BUY','SELL','WAIT','ALERT') NOT NULL,
	`signalType` varchar(32) NOT NULL DEFAULT 'SNRV_SIGNAL',
	`entry` decimal(20,8),
	`stopLoss` decimal(20,8),
	`takeProfit1` decimal(20,8),
	`takeProfit2` decimal(20,8),
	`riskReward` decimal(8,3),
	`signalScore` int,
	`confidence` int,
	`phase` varchar(32),
	`bias` varchar(32),
	`confluenceJson` text NOT NULL,
	`indicatorsJson` text NOT NULL,
	`validationOutcome` enum('accepted','rejected','pending','error') NOT NULL,
	`validationMessage` text,
	`deliveryStatus` enum('not_requested','queued','sent','failed') NOT NULL DEFAULT 'not_requested',
	`deliveryError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `signals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `signal_settings_schedule_uid_idx` ON `signal_settings` (`schedule_cron_task_uid`);--> statement-breakpoint
CREATE INDEX `signals_owner_created_idx` ON `signals` (`ownerOpenId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `signals_symbol_created_idx` ON `signals` (`symbol`,`createdAt`);--> statement-breakpoint
CREATE INDEX `signals_source_created_idx` ON `signals` (`source`,`createdAt`);