CREATE TABLE `ai_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`canvas_id` text,
	`kind` text NOT NULL,
	`provider` text NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `inference_runs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`canvas_id`) REFERENCES `canvases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_usage_canvas_idx` ON `ai_usage` (`canvas_id`);--> statement-breakpoint
CREATE INDEX `ai_usage_run_idx` ON `ai_usage` (`run_id`);--> statement-breakpoint
CREATE TABLE `inference_patches` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`node_id` text NOT NULL,
	`before_json` text NOT NULL,
	`after_json` text NOT NULL,
	`applied_at` integer NOT NULL,
	`undone_at` integer,
	FOREIGN KEY (`run_id`) REFERENCES `inference_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`node_id`) REFERENCES `canvas_nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `inference_patches_run_idx` ON `inference_patches` (`run_id`);--> statement-breakpoint
CREATE INDEX `inference_patches_node_idx` ON `inference_patches` (`node_id`);--> statement-breakpoint
CREATE TABLE `inference_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`canvas_id` text NOT NULL,
	`task_type` text DEFAULT 'fill_blank_notes' NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`provider` text NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`hint` text DEFAULT '' NOT NULL,
	`error` text,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`canvas_id`) REFERENCES `canvases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `inference_runs_canvas_idx` ON `inference_runs` (`canvas_id`);--> statement-breakpoint
CREATE INDEX `inference_runs_started_idx` ON `inference_runs` (`started_at`);