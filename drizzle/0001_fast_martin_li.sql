PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_canvas_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`canvas_id` text NOT NULL,
	`type` text DEFAULT 'blank' NOT NULL,
	`role_locked` integer DEFAULT true NOT NULL,
	`source_inspiration_id` text,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`weight` integer DEFAULT 5 NOT NULL,
	`color` text DEFAULT '#3b82f6' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`selected_question` text,
	`result` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`x` real DEFAULT 0 NOT NULL,
	`y` real DEFAULT 0 NOT NULL,
	`width` real DEFAULT 240 NOT NULL,
	`height` real DEFAULT 160 NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`canvas_id`) REFERENCES `canvases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_inspiration_id`) REFERENCES `inspirations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_canvas_nodes`("id", "canvas_id", "type", "role_locked", "source_inspiration_id", "title", "content", "weight", "color", "note", "selected_question", "result", "status", "x", "y", "width", "height", "deleted_at", "created_at", "updated_at") SELECT "id", "canvas_id", "type", 1, "source_inspiration_id", "title", "content", "weight", "color", "note", "selected_question", "result", "status", "x", "y", "width", "height", "deleted_at", "created_at", "updated_at" FROM `canvas_nodes`;--> statement-breakpoint
DROP TABLE `canvas_nodes`;--> statement-breakpoint
ALTER TABLE `__new_canvas_nodes` RENAME TO `canvas_nodes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `canvas_nodes_canvas_idx` ON `canvas_nodes` (`canvas_id`);--> statement-breakpoint
CREATE INDEX `canvas_nodes_type_idx` ON `canvas_nodes` (`type`);