CREATE TABLE `canvas_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`canvas_id` text NOT NULL,
	`type` text DEFAULT 'inspiration' NOT NULL,
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
CREATE INDEX `canvas_nodes_canvas_idx` ON `canvas_nodes` (`canvas_id`);--> statement-breakpoint
CREATE INDEX `canvas_nodes_type_idx` ON `canvas_nodes` (`type`);--> statement-breakpoint
CREATE TABLE `canvases` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`color_legend` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `canvases_updated_idx` ON `canvases` (`updated_at`);--> statement-breakpoint
CREATE TABLE `connections` (
	`id` text PRIMARY KEY NOT NULL,
	`canvas_id` text NOT NULL,
	`from_node_id` text NOT NULL,
	`to_node_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`canvas_id`) REFERENCES `canvases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_node_id`) REFERENCES `canvas_nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_node_id`) REFERENCES `canvas_nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `connections_canvas_idx` ON `connections` (`canvas_id`);--> statement-breakpoint
CREATE INDEX `connections_from_idx` ON `connections` (`from_node_id`);--> statement-breakpoint
CREATE INDEX `connections_to_idx` ON `connections` (`to_node_id`);--> statement-breakpoint
CREATE TABLE `dimension_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`relation_type` text NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`attributes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dimension_groups_connection_idx` ON `dimension_groups` (`connection_id`);--> statement-breakpoint
CREATE TABLE `dimension_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`parent_id` text,
	`label` text NOT NULL,
	`level` text DEFAULT 'main' NOT NULL,
	`selected` integer DEFAULT false NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `dimension_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dimension_nodes_group_idx` ON `dimension_nodes` (`group_id`);--> statement-breakpoint
CREATE INDEX `dimension_nodes_parent_idx` ON `dimension_nodes` (`parent_id`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`output_node_id` text,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`output_node_id`) REFERENCES `canvas_nodes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `documents_output_idx` ON `documents` (`output_node_id`);--> statement-breakpoint
CREATE TABLE `generation_history` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`kind` text NOT NULL,
	`candidates` text,
	`selected` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `generation_history_target_idx` ON `generation_history` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `inspiration_keywords` (
	`id` text PRIMARY KEY NOT NULL,
	`inspiration_id` text NOT NULL,
	`keyword` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`inspiration_id`) REFERENCES `inspirations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `inspiration_keywords_inspiration_idx` ON `inspiration_keywords` (`inspiration_id`);--> statement-breakpoint
CREATE TABLE `inspiration_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`inspiration_id` text NOT NULL,
	`sticky_note_id` text,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`inspiration_id`) REFERENCES `inspirations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `inspiration_notes_inspiration_idx` ON `inspiration_notes` (`inspiration_id`);--> statement-breakpoint
CREATE TABLE `inspirations` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`source_url` text,
	`origin` text DEFAULT 'manual' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`merged_into` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inspirations_status_idx` ON `inspirations` (`status`);--> statement-breakpoint
CREATE TABLE `provenance_links` (
	`id` text PRIMARY KEY NOT NULL,
	`output_node_id` text NOT NULL,
	`context_node_ids` text DEFAULT '[]' NOT NULL,
	`context_connection_ids` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`output_node_id`) REFERENCES `canvas_nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `provenance_links_output_idx` ON `provenance_links` (`output_node_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` integer NOT NULL
);
