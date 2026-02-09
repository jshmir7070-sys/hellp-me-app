CREATE TABLE "admin_bank_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_type" text NOT NULL,
	"bank_name" text NOT NULL,
	"account_number" text NOT NULL,
	"account_holder" text NOT NULL,
	"bank_branch" text,
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "admin_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"domain" text NOT NULL,
	"resource" text NOT NULL,
	"action" text,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "admin_permissions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "admin_role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "admin_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"level" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "admin_roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "announcement_recipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"announcement_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"delivered_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"target_audience" text NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_role" text,
	"user_id" varchar,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"order_id" integer,
	"incident_id" integer,
	"settlement_id" integer,
	"reason" text,
	"old_value" text,
	"new_value" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"event_type" varchar(50) NOT NULL,
	"provider" varchar(30),
	"status" varchar(20) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"request_id" varchar(36),
	"metadata" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "balance_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"pricing_snapshot_id" integer,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_id" integer,
	"paid_at" timestamp,
	"failed_at" timestamp,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "carrier_min_rate_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"set_id" integer NOT NULL,
	"region_code" text NOT NULL,
	"vehicle_type" text NOT NULL,
	"service_type" text NOT NULL,
	"price_type" text DEFAULT 'PER_BOX',
	"min_unit_price" integer NOT NULL,
	"min_total_price" integer,
	"min_boxes" integer,
	"min_distance_km" numeric(10, 2),
	"priority" integer DEFAULT 10,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "carrier_min_rate_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"courier_id" integer NOT NULL,
	"title" text NOT NULL,
	"effective_from" text NOT NULL,
	"effective_to" text,
	"vat_mode" text DEFAULT 'EXCLUSIVE',
	"rounding_unit" integer DEFAULT 100,
	"status" text DEFAULT 'DRAFT',
	"cloned_from_id" integer,
	"activated_at" timestamp,
	"activated_by" varchar,
	"archived_at" timestamp,
	"archived_by" varchar,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "carrier_min_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"courier_id" integer NOT NULL,
	"vehicle_type" text NOT NULL,
	"region" text,
	"district" text,
	"min_rate" integer NOT NULL,
	"effective_from" timestamp NOT NULL,
	"effective_to" timestamp,
	"rounding_rule" text DEFAULT 'round_up_100',
	"vat_included" boolean DEFAULT false,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "carrier_pricing_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"carrier_code" text NOT NULL,
	"service_type" text NOT NULL,
	"region_code" text,
	"vehicle_type" text,
	"unit_type" text DEFAULT 'BOX',
	"unit_price_supply" integer NOT NULL,
	"min_charge_supply" integer,
	"effective_from" text NOT NULL,
	"effective_to" text,
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "carrier_proof_uploads" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"carrier_id" integer,
	"carrier_name" text,
	"proof_type" text DEFAULT 'photo' NOT NULL,
	"file_url" text NOT NULL,
	"note" text,
	"uploaded_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "carrier_rate_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"courier_id" integer NOT NULL,
	"item_name" text NOT NULL,
	"item_type" text NOT NULL,
	"unit_price" integer DEFAULT 0 NOT NULL,
	"include_vat" boolean DEFAULT false,
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "check_in_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer,
	"helper_id" varchar NOT NULL,
	"requester_id" varchar NOT NULL,
	"requester_name" text,
	"check_in_time" timestamp DEFAULT now(),
	"check_out_time" timestamp,
	"latitude" text,
	"longitude" text,
	"address" text,
	"status" text DEFAULT 'checked_in',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_errors" (
	"id" serial PRIMARY KEY NOT NULL,
	"severity" text NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"context" text,
	"user_id" varchar,
	"user_agent" text,
	"url" text,
	"ip_address" text,
	"is_resolved" boolean DEFAULT false,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "closing_field_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_name" text NOT NULL,
	"field_type" text DEFAULT 'text' NOT NULL,
	"is_required" boolean DEFAULT false,
	"placeholder" text,
	"description" text,
	"target_role" text DEFAULT 'helper',
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "closing_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"helper_id" varchar NOT NULL,
	"contract_id" integer,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"returned_count" integer DEFAULT 0 NOT NULL,
	"etc_count" integer DEFAULT 0,
	"etc_price_per_unit" integer,
	"extra_costs_json" text,
	"courier_evidence_files_json" text,
	"proof_files_json" text,
	"delivery_history_images_json" text,
	"etc_images_json" text,
	"dynamic_fields_json" text,
	"memo" text,
	"status" text DEFAULT 'submitted',
	"reviewed_at" timestamp,
	"reviewed_by" varchar,
	"reject_reason" text,
	"calculated_amount" integer,
	"supply_amount" integer,
	"vat_amount" integer,
	"total_amount" integer,
	"platform_fee_rate" integer,
	"platform_fee" integer,
	"net_amount" integer,
	"pricing_snapshot_json" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cold_chain_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"setting_name" text NOT NULL,
	"minimum_fee" integer DEFAULT 0 NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "commission_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"policy_type" text NOT NULL,
	"default_rate" integer DEFAULT 10 NOT NULL,
	"platform_rate" integer DEFAULT 8 NOT NULL,
	"team_leader_rate" integer DEFAULT 2 NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"modified_by" varchar,
	"effective_from" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contact_share_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"requester_user_id" varchar NOT NULL,
	"helper_user_id" varchar NOT NULL,
	"shared_fields" text,
	"triggered_by" text DEFAULT 'requester_selection',
	"trigger_actor_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contract_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer,
	"job_contract_id" integer,
	"document_type" text NOT NULL,
	"storage_path" text NOT NULL,
	"file_size" integer,
	"checksum" text,
	"mime_type" text DEFAULT 'application/pdf',
	"generated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contract_execution_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer,
	"contract_type" text NOT NULL,
	"trigger_type" text NOT NULL,
	"initiated_by" varchar,
	"initiator_role" text,
	"payment_id" integer,
	"ip_address" text,
	"user_agent" text,
	"metadata" text,
	"executed_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"helper_id" varchar NOT NULL,
	"requester_id" varchar NOT NULL,
	"total_amount" integer NOT NULL,
	"deposit_amount" integer NOT NULL,
	"balance_amount" integer NOT NULL,
	"deposit_paid" boolean DEFAULT false,
	"balance_paid" boolean DEFAULT false,
	"deposit_paid_at" timestamp,
	"balance_paid_at" timestamp,
	"balance_due_date" text,
	"status" text DEFAULT 'pending',
	"down_payment_amount" integer,
	"down_payment_status" text DEFAULT 'pending',
	"down_payment_paid_at" timestamp,
	"final_amount" integer,
	"final_amount_confirmed_at" timestamp,
	"calculated_balance_amount" integer,
	"balance_status" text DEFAULT 'pending',
	"closing_report_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cost_item_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sign" text DEFAULT 'plus' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "courier_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"courier_name" text NOT NULL,
	"category" text DEFAULT 'parcel' NOT NULL,
	"base_price_per_box" integer DEFAULT 0 NOT NULL,
	"etc_price_per_box" integer DEFAULT 0,
	"min_delivery_fee" integer DEFAULT 0 NOT NULL,
	"min_total" integer DEFAULT 0 NOT NULL,
	"commission_rate" integer DEFAULT 0 NOT NULL,
	"urgent_commission_rate" integer DEFAULT 0 NOT NULL,
	"urgent_surcharge_rate" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"deleted_at" timestamp,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "courier_settings_courier_name_unique" UNIQUE("courier_name")
);
--> statement-breakpoint
CREATE TABLE "courier_tiered_pricing" (
	"id" serial PRIMARY KEY NOT NULL,
	"courier_id" integer NOT NULL,
	"min_box_count" integer DEFAULT 1 NOT NULL,
	"max_box_count" integer,
	"min_total_vat_inclusive" integer,
	"price_per_box" integer NOT NULL,
	"below_min_increment_per_box" integer DEFAULT 100,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_inquiries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"user_name" text,
	"user_email" text,
	"user_phone" text,
	"category" text NOT NULL,
	"type" text,
	"subject" text NOT NULL,
	"content" text NOT NULL,
	"order_id" integer,
	"attachment_urls" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'normal',
	"assignee_id" varchar,
	"assignee_name" text,
	"response_content" text,
	"responded_at" timestamp,
	"resolved_at" timestamp,
	"closed_at" timestamp,
	"satisfaction_rating" integer,
	"satisfaction_comment" text,
	"source" text DEFAULT 'app',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_service_inquiries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"user_role" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"attachment_urls" text[],
	"status" text DEFAULT 'pending',
	"priority" text DEFAULT 'normal',
	"assigned_to" varchar,
	"admin_note" text,
	"response" text,
	"responded_at" timestamp,
	"responded_by" varchar,
	"order_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deductions" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer,
	"incident_id" integer,
	"helper_id" varchar,
	"requester_id" varchar,
	"target_type" text NOT NULL,
	"target_id" varchar NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"category" text,
	"status" text DEFAULT 'pending',
	"applied_to_settlement_id" integer,
	"applied_at" timestamp,
	"applied_by" varchar,
	"created_by" varchar,
	"memo" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "destination_pricing" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_category" text NOT NULL,
	"courier_id" integer,
	"destination_region" text NOT NULL,
	"time_slot" text NOT NULL,
	"price_per_box" integer DEFAULT 0 NOT NULL,
	"minimum_fee" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dispatch_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer,
	"requester_id" varchar NOT NULL,
	"pickup_address" text NOT NULL,
	"delivery_address" text NOT NULL,
	"urgency" text DEFAULT 'normal',
	"status" text DEFAULT 'pending',
	"assigned_helper_id" varchar,
	"assigned_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" serial PRIMARY KEY NOT NULL,
	"helper_id" varchar NOT NULL,
	"submitter_role" text DEFAULT 'helper',
	"courier_name" text,
	"invoice_number" text,
	"evidence_photo_url" text,
	"settlement_id" integer,
	"order_id" integer,
	"work_date" text NOT NULL,
	"dispute_type" text NOT NULL,
	"description" text NOT NULL,
	"requested_delivery_count" integer,
	"requested_return_count" integer,
	"requested_pickup_count" integer,
	"requested_other_count" integer,
	"status" text DEFAULT 'pending',
	"resolution" text,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"admin_reply" text,
	"admin_reply_at" timestamp,
	"admin_reply_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_review_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"document_type" text NOT NULL,
	"document_id" integer,
	"document_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'normal',
	"assigned_to" varchar,
	"assigned_at" timestamp,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"reject_reason" text,
	"reject_category" text,
	"revision_note" text,
	"due_date" timestamp,
	"sla_breached" boolean DEFAULT false,
	"metadata" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"admin_id" varchar NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"doc_type" text NOT NULL,
	"file_url" text NOT NULL,
	"issued_date" text,
	"expire_date" text,
	"status" text DEFAULT 'UPLOADED' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enterprise_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"business_number" text NOT NULL,
	"contact_name" text,
	"contact_phone" text,
	"contact_email" text,
	"contract_start_date" text,
	"contract_end_date" text,
	"settlement_model" text DEFAULT 'per_order',
	"tax_type" text DEFAULT 'exclusive',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enterprise_order_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"enterprise_id" integer NOT NULL,
	"project_code" text NOT NULL,
	"sla_type" text DEFAULT 'next_day',
	"order_count" integer DEFAULT 0,
	"total_amount" integer DEFAULT 0,
	"status" text DEFAULT 'pending',
	"uploaded_file" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "extra_cost_catalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"cost_code" text NOT NULL,
	"label" text NOT NULL,
	"unit_label" text,
	"default_unit_price_supply" integer,
	"input_mode" text DEFAULT 'QTY_PRICE',
	"require_memo" boolean DEFAULT false,
	"sort_order" integer DEFAULT 100,
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "extra_cost_catalog_cost_code_unique" UNIQUE("cost_code")
);
--> statement-breakpoint
CREATE TABLE "fcm_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"token" text NOT NULL,
	"platform" varchar(50) DEFAULT 'native',
	"device_info" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "help_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"location" text NOT NULL,
	"budget" integer,
	"budget_type" text DEFAULT 'fixed',
	"status" text DEFAULT 'open',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "helper_bank_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"account_holder" text NOT NULL,
	"bank_name" text NOT NULL,
	"account_number" text NOT NULL,
	"bankbook_image_url" text,
	"verification_status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "helper_businesses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"business_number" text NOT NULL,
	"business_name" text NOT NULL,
	"representative_name" text NOT NULL,
	"address" text NOT NULL,
	"business_type" text NOT NULL,
	"business_category" text NOT NULL,
	"email" text,
	"business_image_url" text,
	"verification_status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "helper_commission_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"helper_id" varchar NOT NULL,
	"commission_rate" integer NOT NULL,
	"notes" text,
	"modified_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "helper_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"address" text NOT NULL,
	"category" text NOT NULL,
	"service_description" text,
	"bank_name" text,
	"account_number" text,
	"account_holder" text,
	"id_photo_url" text,
	"verification_status" text DEFAULT 'pending',
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"reject_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "helper_licenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"driver_license_image_url" text,
	"cargo_license_image_url" text,
	"verification_status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "helper_rating_summary" (
	"helper_user_id" varchar PRIMARY KEY NOT NULL,
	"avg_rating" integer,
	"review_count" integer DEFAULT 0,
	"completion_rate" integer,
	"last_30d_jobs" integer DEFAULT 0,
	"total_jobs" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "helper_service_areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"region" text NOT NULL,
	"district" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "helper_terms_agreements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"service_agreed" boolean DEFAULT false,
	"vehicle_agreed" boolean DEFAULT false,
	"liability_agreed" boolean DEFAULT false,
	"settlement_agreed" boolean DEFAULT false,
	"location_agreed" boolean DEFAULT false,
	"privacy_agreed" boolean DEFAULT false,
	"signature_data" text,
	"ip_address" text,
	"tracking_number" text,
	"user_agent" text,
	"consent_log" text,
	"contract_content" text,
	"agreed_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "helper_vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"vehicle_type" text NOT NULL,
	"plate_number" text NOT NULL,
	"vehicle_image_url" text,
	"verification_status" text DEFAULT 'pending',
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"reject_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"user_id" varchar NOT NULL,
	"endpoint" text NOT NULL,
	"request_hash" text,
	"response_status" integer NOT NULL,
	"response_body" text NOT NULL,
	"status" text DEFAULT 'COMPLETED',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" text NOT NULL,
	"verification_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"verified_name" text,
	"verified_phone" text,
	"verified_birth_date" text,
	"verified_gender" text,
	"ci" text,
	"di" text,
	"failure_reason" text,
	"failure_code" text,
	"ip_address" text,
	"user_agent" text,
	"verified_at" timestamp,
	"expires_at" timestamp,
	"raw_response" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "incentive_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"incentive_id" integer NOT NULL,
	"contract_id" integer,
	"helper_id" varchar,
	"contract_amount" integer DEFAULT 0,
	"fee_rate" integer DEFAULT 0,
	"fee_amount" integer DEFAULT 0,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "incentive_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer,
	"default_rate" integer DEFAULT 10,
	"min_threshold" integer DEFAULT 0,
	"payment_cycle" text DEFAULT 'monthly',
	"auto_approve" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "incident_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_id" integer NOT NULL,
	"actor_id" varchar,
	"actor_role" text,
	"action_type" text NOT NULL,
	"previous_status" text,
	"new_status" text,
	"notes" text,
	"metadata" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "incident_evidence" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_id" integer NOT NULL,
	"evidence_type" text NOT NULL,
	"file_url" text,
	"description" text,
	"uploaded_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "incident_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer,
	"job_contract_id" integer,
	"settlement_id" integer,
	"reporter_id" varchar NOT NULL,
	"reporter_type" text,
	"helper_id" varchar,
	"requester_id" varchar,
	"incident_type" text NOT NULL,
	"incident_date" text,
	"description" text NOT NULL,
	"damage_amount" integer,
	"responsibility_party" text,
	"suggested_responsibility" text,
	"resolution" text,
	"resolution_amount" integer,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"status" text DEFAULT 'requested',
	"admin_memo" text,
	"deduction_amount" integer DEFAULT 0,
	"deduction_reason" text,
	"deduction_method" text,
	"deduction_confirmed_at" timestamp,
	"helper_deduction_applied" boolean DEFAULT false,
	"requester_refund_applied" boolean DEFAULT false,
	"evidence_due_at" timestamp,
	"settlement_hold_id" integer,
	"review_started_at" timestamp,
	"reviewer_id" varchar,
	"escalated_at" timestamp,
	"escalated_to" varchar,
	"ip_address" text,
	"tracking_number" text,
	"delivery_address" text,
	"customer_name" text,
	"customer_phone" text,
	"user_agent" text,
	"helper_status" text,
	"helper_action_at" timestamp,
	"helper_note" text,
	"helper_response_deadline" timestamp,
	"helper_response_required" boolean DEFAULT true,
	"admin_force_processed" boolean DEFAULT false,
	"admin_force_processed_at" timestamp,
	"admin_force_processed_by" varchar,
	"admin_force_processed_reason" text,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inquiry_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"inquiry_id" integer NOT NULL,
	"author_id" varchar,
	"author_name" text,
	"author_role" text,
	"content" text NOT NULL,
	"attachment_urls" text,
	"is_internal" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "instruction_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer,
	"job_contract_id" integer,
	"issuer_id" varchar,
	"issuer_name" text,
	"issuer_type" text,
	"instruction_type" text NOT NULL,
	"instruction_content" text NOT NULL,
	"previous_content" text,
	"changed_fields" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"action" text NOT NULL,
	"payload" text NOT NULL,
	"response" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"retry_count" integer DEFAULT 0,
	"last_error" text,
	"next_retry_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration_health" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_name" text NOT NULL,
	"service_type" text NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"last_check_at" timestamp,
	"last_success_at" timestamp,
	"last_failure_at" timestamp,
	"success_count_24h" integer DEFAULT 0,
	"failure_count_24h" integer DEFAULT 0,
	"avg_response_ms" integer,
	"last_error_message" text,
	"last_error_code" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer,
	"helper_id" varchar NOT NULL,
	"requester_id" varchar,
	"instruction_issuer_id" varchar,
	"instruction_issuer_name" text,
	"instruction_issuer_type" text,
	"work_date" text NOT NULL,
	"work_start_time" text,
	"work_end_time" text,
	"work_content" text NOT NULL,
	"task_types" text,
	"payment_amount" integer NOT NULL,
	"liability_scope" text,
	"dispute_responsibility" text,
	"contract_content" text,
	"helper_signature" text,
	"helper_signed_at" timestamp,
	"requester_signature" text,
	"requester_signed_at" timestamp,
	"status" text DEFAULT 'pending',
	"execution_event_id" integer,
	"executed_at" timestamp,
	"execution_status" text DEFAULT 'pending',
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_postings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"work_days" text NOT NULL,
	"vehicle_type" text NOT NULL,
	"fuel_cost" text NOT NULL,
	"commission" text NOT NULL,
	"contact" text NOT NULL,
	"work_details" text NOT NULL,
	"note" text,
	"recruit_count" integer DEFAULT 1,
	"work_start_time" text,
	"work_end_time" text,
	"status" text DEFAULT 'open',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "manual_dispatch_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"helper_id" varchar NOT NULL,
	"dispatch_type" text NOT NULL,
	"reason" text NOT NULL,
	"previous_helper_id" varchar,
	"actor_id" varchar NOT NULL,
	"actor_role" text,
	"helper_confirmed" boolean DEFAULT false,
	"helper_confirmed_at" timestamp,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mg_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"helper_id" varchar NOT NULL,
	"plan_id" integer NOT NULL,
	"status" text DEFAULT 'ENROLLED',
	"enrolled_at" timestamp DEFAULT now(),
	"enrolled_by" varchar,
	"terminated_at" timestamp,
	"terminated_by" varchar,
	"termination_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mg_period_summaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"enrollment_id" integer NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"gross_earnings" integer DEFAULT 0,
	"completed_orders" integer DEFAULT 0,
	"online_minutes" integer DEFAULT 0,
	"eligible" boolean DEFAULT false,
	"guarantee_amount" integer,
	"calculated_topup" integer,
	"locked" boolean DEFAULT false,
	"locked_at" timestamp,
	"locked_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mg_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"period_unit" text NOT NULL,
	"guarantee_amount" integer NOT NULL,
	"eligibility_min_orders" integer,
	"eligibility_min_online_minutes" integer,
	"max_topup_amount" integer,
	"budget_monthly_cap" integer,
	"scope_region_code" text,
	"vehicle_type" text,
	"effective_from" text NOT NULL,
	"effective_to" text,
	"status" text DEFAULT 'DRAFT',
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mg_topups" (
	"id" serial PRIMARY KEY NOT NULL,
	"summary_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'PENDING',
	"settlement_id" integer,
	"applied_at" timestamp,
	"applied_by" varchar,
	"cancelled_at" timestamp,
	"cancelled_by" varchar,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "minimum_guarantee_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"helper_id" varchar NOT NULL,
	"rule_id" integer NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"actual_earnings" integer NOT NULL,
	"guarantee_amount" integer NOT NULL,
	"supplement_amount" integer NOT NULL,
	"work_days" integer DEFAULT 0,
	"completed_orders" integer DEFAULT 0,
	"status" text DEFAULT 'calculated',
	"approved_by" varchar,
	"approved_at" timestamp,
	"paid_at" timestamp,
	"settlement_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "minimum_guarantee_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"courier_id" integer,
	"vehicle_type" text,
	"guarantee_type" text DEFAULT 'daily',
	"min_guarantee_amount" integer NOT NULL,
	"calculation_base" text DEFAULT 'net_amount',
	"supplement_method" text DEFAULT 'auto',
	"conditions" text,
	"is_active" boolean DEFAULT true,
	"effective_from" timestamp DEFAULT now(),
	"effective_to" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"related_id" integer,
	"payload" text,
	"delivery_channel" text NOT NULL,
	"sent_at" timestamp DEFAULT now(),
	"is_delivered" boolean DEFAULT false,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"related_id" integer,
	"phone_number" text,
	"payload" text,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"helper_id" varchar NOT NULL,
	"status" text DEFAULT 'applied',
	"applied_at" timestamp DEFAULT now(),
	"selected_at" timestamp,
	"scheduled_at" timestamp,
	"checked_in_at" timestamp,
	"completed_at" timestamp,
	"processed_at" timestamp,
	"snapshot_commission_rate" integer,
	"snapshot_platform_rate" integer,
	"snapshot_team_leader_rate" integer,
	"snapshot_team_leader_id" varchar,
	"snapshot_source" text,
	CONSTRAINT "order_applications_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "order_applications_order_id_helper_id_unique" UNIQUE("order_id","helper_id")
);
--> statement-breakpoint
CREATE TABLE "order_candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"helper_user_id" varchar NOT NULL,
	"status" text DEFAULT 'applied' NOT NULL,
	"applied_at" timestamp DEFAULT now(),
	"selected_at" timestamp,
	"rejected_at" timestamp,
	"withdrawn_at" timestamp,
	"rank_snapshot" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "order_category_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_name" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"allowed_courier_names" text,
	"is_admin_only" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "order_category_settings_category_name_unique" UNIQUE("category_name")
);
--> statement-breakpoint
CREATE TABLE "order_closure_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"helper_user_id" varchar NOT NULL,
	"delivered_count" integer DEFAULT 0,
	"returned_count" integer DEFAULT 0,
	"other_text" text,
	"submitted_at" timestamp DEFAULT now(),
	"confirmed_by" varchar,
	"confirmed_at" timestamp,
	"is_locked" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "order_cost_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"type_id" integer NOT NULL,
	"quantity" integer DEFAULT 1,
	"unit_price" integer NOT NULL,
	"amount" integer NOT NULL,
	"note" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_force_status_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"previous_status" text NOT NULL,
	"new_status" text NOT NULL,
	"reason" text NOT NULL,
	"actor_id" varchar NOT NULL,
	"actor_role" text,
	"force_override_used" boolean DEFAULT false,
	"related_incident_id" integer,
	"affected_helper_id" varchar,
	"affected_settlement_ids" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_policy_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"pricing_policy_id" integer,
	"snapshot_unit_price_supply" integer,
	"snapshot_min_charge_supply" integer,
	"urgent_policy_id" integer,
	"snapshot_urgent_apply_type" text,
	"snapshot_urgent_value" integer,
	"snapshot_urgent_max_fee" integer,
	"platform_fee_policy_id" integer,
	"snapshot_platform_base_on" text,
	"snapshot_platform_rate_percent" integer,
	"snapshot_platform_min_fee" integer,
	"snapshot_platform_max_fee" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_registration_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_code" text NOT NULL,
	"field_name" text NOT NULL,
	"field_type" text DEFAULT 'text' NOT NULL,
	"is_required" boolean DEFAULT true,
	"placeholder" text,
	"description" text,
	"options" text,
	"default_value" text,
	"validation_rule" text,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "order_registration_fields_field_code_unique" UNIQUE("field_code")
);
--> statement-breakpoint
CREATE TABLE "order_start_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"token" text NOT NULL,
	"created_by" varchar,
	"created_by_role" text,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"used_by" varchar,
	"is_revoked" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "order_start_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "order_status_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"previous_status" text,
	"new_status" text NOT NULL,
	"triggered_by" varchar,
	"trigger_type" text NOT NULL,
	"reason" text,
	"metadata" text,
	"ip_address" text,
	"tracking_number" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_id" varchar,
	"company_name" text NOT NULL,
	"price_per_unit" integer NOT NULL,
	"average_quantity" text NOT NULL,
	"delivery_area" text NOT NULL,
	"scheduled_date" text NOT NULL,
	"scheduled_date_end" text,
	"vehicle_type" text NOT NULL,
	"is_urgent" boolean DEFAULT false,
	"status" text DEFAULT 'awaiting_deposit',
	"approval_status" text DEFAULT 'pending',
	"payment_status" text DEFAULT 'awaiting_deposit',
	"max_helpers" integer DEFAULT 3,
	"current_helpers" integer DEFAULT 0,
	"matched_helper_id" varchar,
	"region_map_url" text,
	"delivery_guide" text,
	"delivery_guide_url" text,
	"camp_address" text,
	"delivery_lat" text,
	"delivery_lng" text,
	"courier_company" text,
	"requester_phone" text,
	"helper_phone_shared" boolean DEFAULT false,
	"matched_at" timestamp,
	"checked_in_at" timestamp,
	"closed_at" timestamp,
	"auto_hide_at" timestamp,
	"hidden_at" timestamp,
	"snapshot_commission_rate" integer,
	"snapshot_platform_rate" integer,
	"snapshot_team_leader_rate" integer,
	"base_price_per_box" integer,
	"final_price_per_box" integer,
	"min_total_applied" integer,
	"contract_confirmed" boolean DEFAULT false,
	"contract_confirmed_at" timestamp,
	"balance_payment_due_date" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_intents" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer,
	"contract_id" integer,
	"payer_id" varchar NOT NULL,
	"payer_role" text NOT NULL,
	"payment_type" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'KRW',
	"status" text DEFAULT 'created' NOT NULL,
	"pg_provider" text,
	"pg_payment_id" text,
	"pg_order_id" text,
	"payment_method" text,
	"card_info" text,
	"virtual_account_info" text,
	"failure_code" text,
	"failure_message" text,
	"metadata" text,
	"expires_at" timestamp,
	"confirmed_at" timestamp,
	"cancelled_at" timestamp,
	"idempotency_key" text,
	"client_ip" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "payment_intents_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "payment_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_id" varchar NOT NULL,
	"order_id" integer,
	"order_number" text NOT NULL,
	"unpaid_amount" integer NOT NULL,
	"due_date" text NOT NULL,
	"overdue_date" text,
	"reminder_level" integer DEFAULT 0,
	"signature_data" text,
	"agreed_at" timestamp,
	"phone_number" text,
	"phone_verified" boolean DEFAULT false,
	"phone_verified_at" timestamp,
	"ip_address" text,
	"tracking_number" text,
	"user_agent" text,
	"consent_log" text,
	"contract_content" text,
	"first_reminder_sent_at" timestamp,
	"second_reminder_sent_at" timestamp,
	"third_reminder_sent_at" timestamp,
	"certified_mail_printed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_status_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"previous_status" text,
	"new_status" text NOT NULL,
	"changed_by" varchar,
	"reason" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer,
	"job_contract_id" integer,
	"order_id" integer,
	"payer_id" varchar NOT NULL,
	"provider" text NOT NULL,
	"provider_payment_id" text,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'KRW',
	"payment_type" text NOT NULL,
	"status" text DEFAULT 'initiated',
	"deposit_flag" boolean DEFAULT false,
	"paid_at" timestamp,
	"canceled_at" timestamp,
	"refunded_at" timestamp,
	"cancel_reason" text,
	"refund_reason" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payout_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"payout_id" integer NOT NULL,
	"previous_status" text,
	"new_status" text NOT NULL,
	"reason" text,
	"actor_id" varchar,
	"metadata" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"settlement_id" integer NOT NULL,
	"helper_id" varchar NOT NULL,
	"amount" integer NOT NULL,
	"bank_name" text NOT NULL,
	"account_number" text NOT NULL,
	"account_holder" text NOT NULL,
	"status" text DEFAULT 'REQUESTED',
	"requested_at" timestamp DEFAULT now(),
	"sent_at" timestamp,
	"succeeded_at" timestamp,
	"failed_at" timestamp,
	"failure_code" text,
	"failure_message" text,
	"retry_count" integer DEFAULT 0,
	"external_ref" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "phone_verification_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone_number" text NOT NULL,
	"code" text NOT NULL,
	"user_id" varchar,
	"purpose" text DEFAULT 'phone_verify',
	"is_used" boolean DEFAULT false,
	"expires_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0,
	"ip_address" text,
	"tracking_number" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_fee_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"base_on" text NOT NULL,
	"fee_type" text DEFAULT 'PERCENT',
	"rate_percent" integer,
	"fixed_amount" integer,
	"min_fee" integer,
	"max_fee" integer,
	"effective_from" text NOT NULL,
	"effective_to" text,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "policy_consents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"policy_type" text NOT NULL,
	"policy_version" text NOT NULL,
	"agreed_at" timestamp DEFAULT now(),
	"ip_address" text,
	"user_agent" text,
	"consent_method" text DEFAULT 'click',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "policy_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer,
	"settlement_id" integer,
	"snapshot_type" text NOT NULL,
	"rate_set_id" integer,
	"rate_rule_id" integer,
	"mg_plan_id" integer,
	"commission_policy_id" integer,
	"snapshot_data" text NOT NULL,
	"vat_mode" text,
	"rounding_unit" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "policy_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"policy_type" text NOT NULL,
	"version" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"effective_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT true,
	"requires_reagreement" boolean DEFAULT false,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "price_conversion_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"courier_id" integer,
	"work_type" text,
	"time_slot" text,
	"conversion_type" text DEFAULT 'ceiling',
	"unit" integer DEFAULT 100,
	"priority" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pricing_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"base_supply_amount" integer NOT NULL,
	"vat_amount" integer NOT NULL,
	"gross_amount" integer NOT NULL,
	"deposit_amount" integer NOT NULL,
	"balance_amount" integer NOT NULL,
	"cost_plus_total" integer DEFAULT 0,
	"cost_minus_total" integer DEFAULT 0,
	"final_gross_amount" integer,
	"final_balance_amount" integer,
	"platform_fee" integer,
	"helper_payout" integer,
	"computed_at" timestamp DEFAULT now(),
	"is_finalized" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "pricing_table_rows" (
	"id" serial PRIMARY KEY NOT NULL,
	"table_id" integer NOT NULL,
	"distance_from" integer,
	"distance_to" integer,
	"weight_from" integer,
	"weight_to" integer,
	"size_category" text,
	"base_rate" integer NOT NULL,
	"per_km_rate" integer,
	"surcharge" integer DEFAULT 0,
	"surcharge_reason" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pricing_tables" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"courier_id" integer,
	"vehicle_type" text,
	"effective_from" timestamp NOT NULL,
	"effective_to" timestamp,
	"vat_included" boolean DEFAULT false,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proof_upload_failures" (
	"id" serial PRIMARY KEY NOT NULL,
	"helper_id" varchar NOT NULL,
	"order_id" integer,
	"session_id" integer,
	"proof_type" text NOT NULL,
	"local_file_path" text,
	"failure_reason" text,
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"last_retry_at" timestamp,
	"next_retry_at" timestamp,
	"status" text DEFAULT 'pending',
	"uploaded_proof_id" integer,
	"metadata" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "push_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"push_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"device_id" varchar(128) NOT NULL,
	"push_token" text NOT NULL,
	"status" varchar(32) NOT NULL,
	"error_message" text,
	"sent_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "push_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"push_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"device_id" varchar(128) NOT NULL,
	"event_type" varchar(32) NOT NULL,
	"event_at" timestamp DEFAULT now(),
	"meta" text
);
--> statement-breakpoint
CREATE TABLE "push_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"payload" text,
	"target_type" varchar(32) NOT NULL,
	"target_id" varchar,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "push_notification_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_user_id" varchar,
	"recipient_device_token" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"data" text,
	"category" text,
	"related_entity_type" text,
	"related_entity_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text DEFAULT 'expo',
	"provider_id" text,
	"error_message" text,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"clicked_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"platform" text DEFAULT 'web' NOT NULL,
	"expo_push_token" text,
	"fcm_token" text,
	"web_endpoint" text,
	"web_p256dh" text,
	"web_auth" text,
	"endpoint" text DEFAULT '',
	"p256dh" text DEFAULT '',
	"auth" text DEFAULT '',
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "qr_scan_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"qr_id" integer NOT NULL,
	"scanned_user_id" varchar NOT NULL,
	"result" text NOT NULL,
	"previous_team_id" integer,
	"scanned_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rate_change_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"change_type" text NOT NULL,
	"previous_data" text,
	"new_data" text,
	"reason" text,
	"actor_id" varchar NOT NULL,
	"ip_address" text,
	"tracking_number" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reassignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"from_helper_id" varchar,
	"to_helper_id" varchar,
	"reason" text NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"token" varchar(64) NOT NULL,
	"device_info" text,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "refund_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"before_matching_refund_rate" integer DEFAULT 100 NOT NULL,
	"after_matching_refund_rate" integer DEFAULT 70 NOT NULL,
	"effective_from" text NOT NULL,
	"effective_to" text,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer,
	"order_id" integer,
	"incident_id" integer,
	"requester_id" varchar,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"reason_category" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"refund_method" text,
	"pg_refund_id" text,
	"requested_by" varchar,
	"requested_at" timestamp DEFAULT now(),
	"approved_by" varchar,
	"approved_at" timestamp,
	"completed_at" timestamp,
	"failed_at" timestamp,
	"failure_reason" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "region_pricing_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"courier_id" integer,
	"region_code" text NOT NULL,
	"region_name" text NOT NULL,
	"district_code" text,
	"district_name" text,
	"price_adjustment_type" text DEFAULT 'fixed',
	"price_adjustment_value" integer DEFAULT 0,
	"min_delivery_fee" integer,
	"distance_rate" integer,
	"is_remote_area" boolean DEFAULT false,
	"remote_area_surcharge" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"priority" integer DEFAULT 0,
	"effective_from" timestamp DEFAULT now(),
	"effective_to" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "requester_businesses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"business_number" text NOT NULL,
	"business_name" text NOT NULL,
	"representative_name" text NOT NULL,
	"address" text NOT NULL,
	"business_type" text NOT NULL,
	"business_category" text NOT NULL,
	"business_image_url" text,
	"verification_status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "requester_refund_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"bank_name" text NOT NULL,
	"account_number" text NOT NULL,
	"account_holder" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "requester_refund_accounts_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "requester_service_agreements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"contract_agreed" boolean DEFAULT false,
	"deposit_amount" integer,
	"balance_amount" integer,
	"balance_due_date" text,
	"signature_data" text,
	"phone_number" text,
	"phone_verified" boolean DEFAULT false,
	"phone_verified_at" timestamp,
	"ip_address" text,
	"tracking_number" text,
	"user_agent" text,
	"consent_log" text,
	"contract_content" text,
	"agreed_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"helper_id" varchar NOT NULL,
	"requester_id" varchar NOT NULL,
	"reviewer_type" text DEFAULT 'requester',
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "settlement_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"settlement_id" integer NOT NULL,
	"action_type" text NOT NULL,
	"previous_value" text,
	"new_value" text,
	"changed_fields" text,
	"reason" text,
	"actor_id" varchar,
	"actor_role" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "settlement_line_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"statement_id" integer NOT NULL,
	"item_type" text NOT NULL,
	"item_name" text NOT NULL,
	"quantity" integer DEFAULT 0,
	"unit_price" integer DEFAULT 0,
	"amount" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "settlement_payout_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"settlement_id" integer NOT NULL,
	"attempt_number" integer DEFAULT 1,
	"amount" integer NOT NULL,
	"bank_name" text,
	"account_number" text,
	"account_holder" text,
	"status" text DEFAULT 'pending',
	"failure_reason" text,
	"failure_code" text,
	"transaction_id" text,
	"processed_at" timestamp,
	"processed_by" varchar,
	"retry_scheduled_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "settlement_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"helper_id" varchar NOT NULL,
	"closing_report_id" integer,
	"contract_id" integer,
	"base_supply" integer NOT NULL,
	"urgent_fee_supply" integer DEFAULT 0,
	"extra_supply" integer DEFAULT 0,
	"final_supply" integer NOT NULL,
	"vat" integer NOT NULL,
	"final_total" integer NOT NULL,
	"platform_fee_base_on" text,
	"platform_fee_rate" integer,
	"platform_fee" integer NOT NULL,
	"damage_deduction" integer DEFAULT 0,
	"damage_reason" text,
	"driver_payout" integer NOT NULL,
	"breakdown_json" text,
	"deduction_items_json" text,
	"requester_invoice_json" text,
	"helper_payout_json" text,
	"team_leader_id" varchar,
	"team_leader_incentive" integer DEFAULT 0,
	"status" text DEFAULT 'CALCULATED',
	"approved_at" timestamp,
	"approved_by" varchar,
	"paid_at" timestamp,
	"paid_by" varchar,
	"payment_reference" text,
	"calculated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "settlement_statements" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_contract_id" integer,
	"order_id" integer,
	"helper_id" varchar NOT NULL,
	"requester_id" varchar,
	"work_date" text,
	"delivery_count" integer DEFAULT 0,
	"return_count" integer DEFAULT 0,
	"pickup_count" integer DEFAULT 0,
	"other_count" integer DEFAULT 0,
	"base_pay" integer DEFAULT 0,
	"additional_pay" integer DEFAULT 0,
	"penalty" integer DEFAULT 0,
	"deduction" integer DEFAULT 0,
	"commission_rate" integer DEFAULT 0,
	"commission_amount" integer DEFAULT 0,
	"platform_commission" integer DEFAULT 0,
	"team_leader_incentive" integer DEFAULT 0,
	"team_leader_id" varchar,
	"supply_amount" integer DEFAULT 0,
	"vat_amount" integer DEFAULT 0,
	"total_amount" integer DEFAULT 0,
	"net_amount" integer DEFAULT 0,
	"helper_confirmed" boolean DEFAULT false,
	"helper_confirmed_at" timestamp,
	"helper_signature" text,
	"helper_ip_address" text,
	"helper_user_agent" text,
	"statement_content" text,
	"status" text DEFAULT 'pending',
	"is_on_hold" boolean DEFAULT false,
	"hold_reason" text,
	"hold_incident_id" integer,
	"hold_started_at" timestamp,
	"hold_released_at" timestamp,
	"is_locked" boolean DEFAULT false,
	"locked_at" timestamp,
	"locked_by" varchar,
	"lock_reason" text,
	"version" integer DEFAULT 1,
	"last_modified_by" varchar,
	"last_modified_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sms_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer,
	"recipient_phone" text NOT NULL,
	"recipient_user_id" varchar,
	"content" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text,
	"provider_id" text,
	"error_code" text,
	"error_message" text,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"cost" integer,
	"retry_count" integer DEFAULT 0,
	"metadata" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sms_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"content" text NOT NULL,
	"variables" text,
	"sender_type" text DEFAULT 'default',
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sms_templates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "staff_role_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"role_id" integer NOT NULL,
	"assigned_by" varchar,
	"scope_type" text,
	"scope_value" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "substitute_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_id" varchar NOT NULL,
	"order_id" integer,
	"urgency_level" text DEFAULT 'normal',
	"request_date" text NOT NULL,
	"work_date" text NOT NULL,
	"work_content" text,
	"base_payment" integer,
	"urgency_premium" integer DEFAULT 0,
	"total_payment" integer,
	"matched_helper_id" varchar,
	"matched_at" timestamp,
	"matching_score" integer,
	"status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "support_ticket_escalations" (
	"id" serial PRIMARY KEY NOT NULL,
	"inquiry_id" integer NOT NULL,
	"escalation_type" text NOT NULL,
	"escalated_by" varchar NOT NULL,
	"escalated_to" varchar,
	"reason" text NOT NULL,
	"priority" text DEFAULT 'high',
	"due_date" timestamp,
	"resolved_at" timestamp,
	"resolution" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"source" text NOT NULL,
	"message" text NOT NULL,
	"details" text,
	"related_entity_type" text,
	"related_entity_id" text,
	"resolved_at" timestamp,
	"resolved_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "system_settings_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
CREATE TABLE "tax_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer,
	"order_id" integer,
	"settlement_id" integer,
	"popbill_ntsconfirm_num" text,
	"popbill_item_key" text,
	"popbill_mgt_key" text,
	"invoice_number" text,
	"issue_type" text DEFAULT 'forward',
	"invoice_kind" text DEFAULT 'tax',
	"supplier_corp_num" text,
	"supplier_corp_name" text,
	"supplier_ceo_name" text,
	"supplier_addr" text,
	"supplier_biz_type" text,
	"supplier_biz_class" text,
	"supplier_email" text,
	"buyer_corp_num" text,
	"buyer_corp_name" text,
	"buyer_ceo_name" text,
	"buyer_addr" text,
	"buyer_biz_type" text,
	"buyer_biz_class" text,
	"buyer_email" text,
	"supply_amount" integer DEFAULT 0,
	"vat_amount" integer DEFAULT 0,
	"total_amount" integer DEFAULT 0,
	"write_date" text,
	"issue_date" text,
	"detail_list" text,
	"status" text DEFAULT 'draft',
	"popbill_status" text,
	"nts_result" text,
	"nts_send_dt" timestamp,
	"nts_result_dt" timestamp,
	"remark1" text,
	"remark2" text,
	"remark3" text,
	"cancelled_at" timestamp,
	"cancelled_by" varchar,
	"cancel_reason" text,
	"pdf_url" text,
	"invoice_scope" text DEFAULT 'individual',
	"target_month" text,
	"target_user_id" varchar,
	"target_user_type" text,
	"settlement_ids" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"tracking_number" text,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "team_commission_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"commission_rate" integer NOT NULL,
	"platform_rate" integer DEFAULT 8,
	"team_leader_rate" integer DEFAULT 2,
	"notes" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_incentives" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"period" text NOT NULL,
	"total_fees" integer DEFAULT 0,
	"incentive_rate" integer DEFAULT 10,
	"incentive_amount" integer DEFAULT 0,
	"status" text DEFAULT 'pending',
	"approved_by" varchar,
	"approved_at" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"helper_id" varchar NOT NULL,
	"is_active" boolean DEFAULT true,
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_qr_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"code" text NOT NULL,
	"qr_type" text DEFAULT 'TEAM_JOIN_QR',
	"expires_at" timestamp,
	"scan_count" integer DEFAULT 0,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "team_qr_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"leader_id" varchar NOT NULL,
	"name" text NOT NULL,
	"qr_code_token" text NOT NULL,
	"business_type" text,
	"emergency_phone" text,
	"commission_rate" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "teams_qr_code_token_unique" UNIQUE("qr_code_token")
);
--> statement-breakpoint
CREATE TABLE "ticket_escalations" (
	"id" serial PRIMARY KEY NOT NULL,
	"inquiry_id" integer NOT NULL,
	"escalation_type" text NOT NULL,
	"reason" text NOT NULL,
	"priority" text DEFAULT 'high' NOT NULL,
	"escalated_by" varchar,
	"escalated_by_name" text,
	"assigned_to" varchar,
	"assigned_to_name" text,
	"due_date" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolution" text,
	"resolved_at" timestamp,
	"resolved_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "urgent_fee_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"carrier_code" text,
	"apply_type" text NOT NULL,
	"value" integer NOT NULL,
	"max_urgent_fee_supply" integer,
	"effective_from" text NOT NULL,
	"effective_to" text,
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"platform" varchar(20) NOT NULL,
	"device_id" varchar(128) NOT NULL,
	"model" varchar(128),
	"os_version" varchar(64),
	"app_version" varchar(64),
	"push_token" text,
	"push_token_updated_at" timestamp,
	"last_seen_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_location_latest" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"latitude" text,
	"longitude" text,
	"accuracy" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_location_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"latitude" text NOT NULL,
	"longitude" text NOT NULL,
	"accuracy" text,
	"captured_at" timestamp DEFAULT now(),
	"source" varchar(32) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"device_id" varchar(128) NOT NULL,
	"camera_status" varchar(32) DEFAULT 'unknown' NOT NULL,
	"location_status" varchar(32) DEFAULT 'unknown' NOT NULL,
	"notification_status" varchar(32) DEFAULT 'unknown' NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_sanctions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"sanction_type" text NOT NULL,
	"reason" text NOT NULL,
	"evidence" text,
	"start_date" text,
	"end_date" text,
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"nickname" text,
	"zip_code" text,
	"address" text,
	"address_detail" text,
	"birth_date" text,
	"phone_number" text,
	"role" text NOT NULL,
	"is_team_leader" boolean DEFAULT false,
	"is_hq_staff" boolean DEFAULT false,
	"team_name" text,
	"daily_status" text DEFAULT 'waiting',
	"push_enabled" boolean DEFAULT true,
	"location_consent" boolean DEFAULT false,
	"latitude" text,
	"longitude" text,
	"location_updated_at" timestamp,
	"tax_invoice_enabled" boolean DEFAULT false,
	"check_in_token" text,
	"onboarding_status" text DEFAULT 'pending',
	"onboarding_reject_reason" text,
	"onboarding_reviewed_at" timestamp,
	"onboarding_reviewed_by" varchar,
	"identity_verified" boolean DEFAULT false,
	"identity_ci" text,
	"identity_di" text,
	"identity_verified_at" timestamp,
	"helper_verified" boolean DEFAULT false,
	"helper_verified_at" timestamp,
	"helper_verified_by" varchar,
	"profile_image_url" text,
	"kakao_id" text,
	"naver_id" text,
	"must_change_password" boolean DEFAULT false,
	"admin_status" text DEFAULT 'pending',
	"notification_preferences" text,
	"approved_at" timestamp,
	"approved_by" varchar,
	"password_changed_at" timestamp,
	"personal_code" text,
	"position" text,
	"department" text,
	"menu_permissions" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_personal_code_unique" UNIQUE("personal_code")
);
--> statement-breakpoint
CREATE TABLE "vat_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"courier_id" integer,
	"transaction_type" text NOT NULL,
	"vat_included" boolean DEFAULT true,
	"vat_rate" integer DEFAULT 10,
	"description" text,
	"is_active" boolean DEFAULT true,
	"effective_from" timestamp DEFAULT now(),
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vehicle_type_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehicle_type_name" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "vehicle_type_settings_vehicle_type_name_unique" UNIQUE("vehicle_type_name")
);
--> statement-breakpoint
CREATE TABLE "virtual_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"payment_id" text NOT NULL,
	"bank_code" text NOT NULL,
	"bank_name" text NOT NULL,
	"account_number" text NOT NULL,
	"account_holder" text NOT NULL,
	"amount" integer NOT NULL,
	"due_date" timestamp,
	"status" text DEFAULT 'pending',
	"paid_at" timestamp,
	"paid_amount" integer,
	"webhook_received_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhook_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"event_type" text NOT NULL,
	"webhook_id" text,
	"payload" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"processed_at" timestamp,
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"related_entity_type" text,
	"related_entity_id" text,
	"idempotency_key" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "work_confirmations" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"helper_id" varchar NOT NULL,
	"proof_image_url" text,
	"helper_submitted_at" timestamp,
	"requester_confirmed_at" timestamp,
	"status" text DEFAULT 'pending',
	"notes" text,
	"delivery_count" integer DEFAULT 0,
	"return_count" integer DEFAULT 0,
	"pickup_count" integer DEFAULT 0,
	"other_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "work_proof_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_session_id" integer,
	"helper_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"photo_url" text,
	"latitude" text,
	"longitude" text,
	"address" text,
	"notes" text,
	"is_first_proof" boolean DEFAULT false,
	"verified_at" timestamp,
	"captured_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "work_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_contract_id" integer,
	"order_id" integer,
	"helper_id" varchar NOT NULL,
	"check_in_time" timestamp,
	"check_in_latitude" text,
	"check_in_longitude" text,
	"check_in_address" text,
	"check_out_time" timestamp,
	"check_out_latitude" text,
	"check_out_longitude" text,
	"check_out_address" text,
	"check_out_photo_url" text,
	"work_confirmed" boolean DEFAULT false,
	"work_confirmed_at" timestamp,
	"status" text DEFAULT 'pending',
	"start_trigger_source" text,
	"start_event_id" integer,
	"started_at" timestamp,
	"started_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_role_id_admin_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."admin_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_permission_id_admin_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."admin_permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_recipients" ADD CONSTRAINT "announcement_recipients_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_recipients" ADD CONSTRAINT "announcement_recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_audit_logs" ADD CONSTRAINT "auth_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_invoices" ADD CONSTRAINT "balance_invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_invoices" ADD CONSTRAINT "balance_invoices_pricing_snapshot_id_pricing_snapshots_id_fk" FOREIGN KEY ("pricing_snapshot_id") REFERENCES "public"."pricing_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_invoices" ADD CONSTRAINT "balance_invoices_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_min_rate_rules" ADD CONSTRAINT "carrier_min_rate_rules_set_id_carrier_min_rate_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."carrier_min_rate_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_min_rate_sets" ADD CONSTRAINT "carrier_min_rate_sets_courier_id_courier_settings_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."courier_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_min_rate_sets" ADD CONSTRAINT "carrier_min_rate_sets_activated_by_users_id_fk" FOREIGN KEY ("activated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_min_rate_sets" ADD CONSTRAINT "carrier_min_rate_sets_archived_by_users_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_min_rate_sets" ADD CONSTRAINT "carrier_min_rate_sets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_min_rates" ADD CONSTRAINT "carrier_min_rates_courier_id_courier_settings_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."courier_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_min_rates" ADD CONSTRAINT "carrier_min_rates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_min_rates" ADD CONSTRAINT "carrier_min_rates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_pricing_policies" ADD CONSTRAINT "carrier_pricing_policies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_proof_uploads" ADD CONSTRAINT "carrier_proof_uploads_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_proof_uploads" ADD CONSTRAINT "carrier_proof_uploads_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_rate_items" ADD CONSTRAINT "carrier_rate_items_courier_id_courier_settings_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."courier_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_records" ADD CONSTRAINT "check_in_records_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_records" ADD CONSTRAINT "check_in_records_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_records" ADD CONSTRAINT "check_in_records_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_errors" ADD CONSTRAINT "client_errors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_errors" ADD CONSTRAINT "client_errors_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closing_field_settings" ADD CONSTRAINT "closing_field_settings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closing_reports" ADD CONSTRAINT "closing_reports_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closing_reports" ADD CONSTRAINT "closing_reports_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closing_reports" ADD CONSTRAINT "closing_reports_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_policies" ADD CONSTRAINT "commission_policies_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_share_events" ADD CONSTRAINT "contact_share_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_share_events" ADD CONSTRAINT "contact_share_events_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_share_events" ADD CONSTRAINT "contact_share_events_helper_user_id_users_id_fk" FOREIGN KEY ("helper_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_share_events" ADD CONSTRAINT "contact_share_events_trigger_actor_id_users_id_fk" FOREIGN KEY ("trigger_actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_execution_events" ADD CONSTRAINT "contract_execution_events_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_tiered_pricing" ADD CONSTRAINT "courier_tiered_pricing_courier_id_courier_settings_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."courier_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_inquiries" ADD CONSTRAINT "customer_inquiries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_inquiries" ADD CONSTRAINT "customer_inquiries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_inquiries" ADD CONSTRAINT "customer_inquiries_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_inquiries" ADD CONSTRAINT "customer_service_inquiries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_inquiries" ADD CONSTRAINT "customer_service_inquiries_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_inquiries" ADD CONSTRAINT "customer_service_inquiries_responded_by_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deductions" ADD CONSTRAINT "deductions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deductions" ADD CONSTRAINT "deductions_incident_id_incident_reports_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deductions" ADD CONSTRAINT "deductions_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deductions" ADD CONSTRAINT "deductions_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deductions" ADD CONSTRAINT "deductions_target_id_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deductions" ADD CONSTRAINT "deductions_applied_by_users_id_fk" FOREIGN KEY ("applied_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deductions" ADD CONSTRAINT "deductions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_pricing" ADD CONSTRAINT "destination_pricing_courier_id_courier_settings_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."courier_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_requests" ADD CONSTRAINT "dispatch_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_requests" ADD CONSTRAINT "dispatch_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_requests" ADD CONSTRAINT "dispatch_requests_assigned_helper_id_users_id_fk" FOREIGN KEY ("assigned_helper_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_settlement_id_settlement_statements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlement_statements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_admin_reply_by_users_id_fk" FOREIGN KEY ("admin_reply_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_review_tasks" ADD CONSTRAINT "document_review_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_review_tasks" ADD CONSTRAINT "document_review_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_review_tasks" ADD CONSTRAINT "document_review_tasks_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_reviews" ADD CONSTRAINT "document_reviews_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_reviews" ADD CONSTRAINT "document_reviews_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_order_batches" ADD CONSTRAINT "enterprise_order_batches_enterprise_id_enterprise_accounts_id_fk" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprise_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extra_cost_catalog" ADD CONSTRAINT "extra_cost_catalog_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fcm_tokens" ADD CONSTRAINT "fcm_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_posts" ADD CONSTRAINT "help_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_bank_accounts" ADD CONSTRAINT "helper_bank_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_businesses" ADD CONSTRAINT "helper_businesses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_commission_overrides" ADD CONSTRAINT "helper_commission_overrides_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_commission_overrides" ADD CONSTRAINT "helper_commission_overrides_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_credentials" ADD CONSTRAINT "helper_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_licenses" ADD CONSTRAINT "helper_licenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_rating_summary" ADD CONSTRAINT "helper_rating_summary_helper_user_id_users_id_fk" FOREIGN KEY ("helper_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_service_areas" ADD CONSTRAINT "helper_service_areas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_terms_agreements" ADD CONSTRAINT "helper_terms_agreements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_vehicles" ADD CONSTRAINT "helper_vehicles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_details" ADD CONSTRAINT "incentive_details_incentive_id_team_incentives_id_fk" FOREIGN KEY ("incentive_id") REFERENCES "public"."team_incentives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_details" ADD CONSTRAINT "incentive_details_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_details" ADD CONSTRAINT "incentive_details_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_policies" ADD CONSTRAINT "incentive_policies_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_actions" ADD CONSTRAINT "incident_actions_incident_id_incident_reports_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_actions" ADD CONSTRAINT "incident_actions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_evidence" ADD CONSTRAINT "incident_evidence_incident_id_incident_reports_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_evidence" ADD CONSTRAINT "incident_evidence_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_job_contract_id_job_contracts_id_fk" FOREIGN KEY ("job_contract_id") REFERENCES "public"."job_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_escalated_to_users_id_fk" FOREIGN KEY ("escalated_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_admin_force_processed_by_users_id_fk" FOREIGN KEY ("admin_force_processed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_comments" ADD CONSTRAINT "inquiry_comments_inquiry_id_customer_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."customer_inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_comments" ADD CONSTRAINT "inquiry_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instruction_logs" ADD CONSTRAINT "instruction_logs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instruction_logs" ADD CONSTRAINT "instruction_logs_job_contract_id_job_contracts_id_fk" FOREIGN KEY ("job_contract_id") REFERENCES "public"."job_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instruction_logs" ADD CONSTRAINT "instruction_logs_issuer_id_users_id_fk" FOREIGN KEY ("issuer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_contracts" ADD CONSTRAINT "job_contracts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_contracts" ADD CONSTRAINT "job_contracts_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_contracts" ADD CONSTRAINT "job_contracts_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_contracts" ADD CONSTRAINT "job_contracts_instruction_issuer_id_users_id_fk" FOREIGN KEY ("instruction_issuer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_dispatch_logs" ADD CONSTRAINT "manual_dispatch_logs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_dispatch_logs" ADD CONSTRAINT "manual_dispatch_logs_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_dispatch_logs" ADD CONSTRAINT "manual_dispatch_logs_previous_helper_id_users_id_fk" FOREIGN KEY ("previous_helper_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_dispatch_logs" ADD CONSTRAINT "manual_dispatch_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mg_enrollments" ADD CONSTRAINT "mg_enrollments_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mg_enrollments" ADD CONSTRAINT "mg_enrollments_plan_id_mg_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."mg_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mg_enrollments" ADD CONSTRAINT "mg_enrollments_enrolled_by_users_id_fk" FOREIGN KEY ("enrolled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mg_enrollments" ADD CONSTRAINT "mg_enrollments_terminated_by_users_id_fk" FOREIGN KEY ("terminated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mg_period_summaries" ADD CONSTRAINT "mg_period_summaries_enrollment_id_mg_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."mg_enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mg_period_summaries" ADD CONSTRAINT "mg_period_summaries_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mg_plans" ADD CONSTRAINT "mg_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mg_topups" ADD CONSTRAINT "mg_topups_summary_id_mg_period_summaries_id_fk" FOREIGN KEY ("summary_id") REFERENCES "public"."mg_period_summaries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mg_topups" ADD CONSTRAINT "mg_topups_settlement_id_settlement_statements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlement_statements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mg_topups" ADD CONSTRAINT "mg_topups_applied_by_users_id_fk" FOREIGN KEY ("applied_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mg_topups" ADD CONSTRAINT "mg_topups_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minimum_guarantee_applications" ADD CONSTRAINT "minimum_guarantee_applications_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minimum_guarantee_applications" ADD CONSTRAINT "minimum_guarantee_applications_rule_id_minimum_guarantee_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."minimum_guarantee_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minimum_guarantee_applications" ADD CONSTRAINT "minimum_guarantee_applications_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minimum_guarantee_applications" ADD CONSTRAINT "minimum_guarantee_applications_settlement_id_settlement_statements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlement_statements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minimum_guarantee_rules" ADD CONSTRAINT "minimum_guarantee_rules_courier_id_courier_settings_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."courier_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minimum_guarantee_rules" ADD CONSTRAINT "minimum_guarantee_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_applications" ADD CONSTRAINT "order_applications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_applications" ADD CONSTRAINT "order_applications_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_applications" ADD CONSTRAINT "order_applications_snapshot_team_leader_id_users_id_fk" FOREIGN KEY ("snapshot_team_leader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_candidates" ADD CONSTRAINT "order_candidates_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_candidates" ADD CONSTRAINT "order_candidates_helper_user_id_users_id_fk" FOREIGN KEY ("helper_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_closure_reports" ADD CONSTRAINT "order_closure_reports_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_closure_reports" ADD CONSTRAINT "order_closure_reports_helper_user_id_users_id_fk" FOREIGN KEY ("helper_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_closure_reports" ADD CONSTRAINT "order_closure_reports_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_cost_items" ADD CONSTRAINT "order_cost_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_cost_items" ADD CONSTRAINT "order_cost_items_type_id_cost_item_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."cost_item_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_cost_items" ADD CONSTRAINT "order_cost_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_force_status_logs" ADD CONSTRAINT "order_force_status_logs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_force_status_logs" ADD CONSTRAINT "order_force_status_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_force_status_logs" ADD CONSTRAINT "order_force_status_logs_affected_helper_id_users_id_fk" FOREIGN KEY ("affected_helper_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_policy_snapshots" ADD CONSTRAINT "order_policy_snapshots_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_registration_fields" ADD CONSTRAINT "order_registration_fields_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_start_tokens" ADD CONSTRAINT "order_start_tokens_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_start_tokens" ADD CONSTRAINT "order_start_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_start_tokens" ADD CONSTRAINT "order_start_tokens_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_matched_helper_id_users_id_fk" FOREIGN KEY ("matched_helper_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_contract_id_job_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."job_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_payer_id_users_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_status_events" ADD CONSTRAINT "payment_status_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_status_events" ADD CONSTRAINT "payment_status_events_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_id_users_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_events" ADD CONSTRAINT "payout_events_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_events" ADD CONSTRAINT "payout_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_settlement_id_settlement_statements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlement_statements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_verification_codes" ADD CONSTRAINT "phone_verification_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_fee_policies" ADD CONSTRAINT "platform_fee_policies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_consents" ADD CONSTRAINT "policy_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_snapshots" ADD CONSTRAINT "policy_snapshots_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_snapshots" ADD CONSTRAINT "policy_snapshots_settlement_id_settlement_statements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlement_statements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_conversion_rules" ADD CONSTRAINT "price_conversion_rules_courier_id_courier_settings_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."courier_settings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_snapshots" ADD CONSTRAINT "pricing_snapshots_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_table_rows" ADD CONSTRAINT "pricing_table_rows_table_id_pricing_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."pricing_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_tables" ADD CONSTRAINT "pricing_tables_courier_id_courier_settings_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."courier_settings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_tables" ADD CONSTRAINT "pricing_tables_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_upload_failures" ADD CONSTRAINT "proof_upload_failures_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_upload_failures" ADD CONSTRAINT "proof_upload_failures_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_upload_failures" ADD CONSTRAINT "proof_upload_failures_session_id_work_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."work_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_push_id_push_messages_id_fk" FOREIGN KEY ("push_id") REFERENCES "public"."push_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_events" ADD CONSTRAINT "push_events_push_id_push_messages_id_fk" FOREIGN KEY ("push_id") REFERENCES "public"."push_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_events" ADD CONSTRAINT "push_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_messages" ADD CONSTRAINT "push_messages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_notification_logs" ADD CONSTRAINT "push_notification_logs_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_scan_logs" ADD CONSTRAINT "qr_scan_logs_qr_id_team_qr_codes_id_fk" FOREIGN KEY ("qr_id") REFERENCES "public"."team_qr_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_scan_logs" ADD CONSTRAINT "qr_scan_logs_scanned_user_id_users_id_fk" FOREIGN KEY ("scanned_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_change_logs" ADD CONSTRAINT "rate_change_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reassignments" ADD CONSTRAINT "reassignments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reassignments" ADD CONSTRAINT "reassignments_from_helper_id_users_id_fk" FOREIGN KEY ("from_helper_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reassignments" ADD CONSTRAINT "reassignments_to_helper_id_users_id_fk" FOREIGN KEY ("to_helper_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reassignments" ADD CONSTRAINT "reassignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_policies" ADD CONSTRAINT "refund_policies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_incident_id_incident_reports_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region_pricing_rules" ADD CONSTRAINT "region_pricing_rules_courier_id_courier_settings_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."courier_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region_pricing_rules" ADD CONSTRAINT "region_pricing_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requester_businesses" ADD CONSTRAINT "requester_businesses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requester_refund_accounts" ADD CONSTRAINT "requester_refund_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requester_service_agreements" ADD CONSTRAINT "requester_service_agreements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_audit_logs" ADD CONSTRAINT "settlement_audit_logs_settlement_id_settlement_statements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlement_statements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_audit_logs" ADD CONSTRAINT "settlement_audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_line_items" ADD CONSTRAINT "settlement_line_items_statement_id_settlement_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."settlement_statements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_payout_attempts" ADD CONSTRAINT "settlement_payout_attempts_settlement_id_settlement_statements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlement_statements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_payout_attempts" ADD CONSTRAINT "settlement_payout_attempts_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_records" ADD CONSTRAINT "settlement_records_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_records" ADD CONSTRAINT "settlement_records_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_records" ADD CONSTRAINT "settlement_records_closing_report_id_closing_reports_id_fk" FOREIGN KEY ("closing_report_id") REFERENCES "public"."closing_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_records" ADD CONSTRAINT "settlement_records_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_records" ADD CONSTRAINT "settlement_records_team_leader_id_users_id_fk" FOREIGN KEY ("team_leader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_records" ADD CONSTRAINT "settlement_records_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_records" ADD CONSTRAINT "settlement_records_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_statements" ADD CONSTRAINT "settlement_statements_job_contract_id_job_contracts_id_fk" FOREIGN KEY ("job_contract_id") REFERENCES "public"."job_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_statements" ADD CONSTRAINT "settlement_statements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_statements" ADD CONSTRAINT "settlement_statements_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_statements" ADD CONSTRAINT "settlement_statements_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_statements" ADD CONSTRAINT "settlement_statements_team_leader_id_users_id_fk" FOREIGN KEY ("team_leader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_statements" ADD CONSTRAINT "settlement_statements_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_statements" ADD CONSTRAINT "settlement_statements_last_modified_by_users_id_fk" FOREIGN KEY ("last_modified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_template_id_sms_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."sms_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_templates" ADD CONSTRAINT "sms_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_templates" ADD CONSTRAINT "sms_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_role_assignments" ADD CONSTRAINT "staff_role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_role_assignments" ADD CONSTRAINT "staff_role_assignments_role_id_admin_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."admin_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_role_assignments" ADD CONSTRAINT "staff_role_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substitute_requests" ADD CONSTRAINT "substitute_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substitute_requests" ADD CONSTRAINT "substitute_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substitute_requests" ADD CONSTRAINT "substitute_requests_matched_helper_id_users_id_fk" FOREIGN KEY ("matched_helper_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_escalations" ADD CONSTRAINT "support_ticket_escalations_inquiry_id_customer_service_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."customer_service_inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_escalations" ADD CONSTRAINT "support_ticket_escalations_escalated_by_users_id_fk" FOREIGN KEY ("escalated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_escalations" ADD CONSTRAINT "support_ticket_escalations_escalated_to_users_id_fk" FOREIGN KEY ("escalated_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_events" ADD CONSTRAINT "system_events_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_settlement_id_settlement_records_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlement_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_commission_overrides" ADD CONSTRAINT "team_commission_overrides_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_incentives" ADD CONSTRAINT "team_incentives_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_incentives" ADD CONSTRAINT "team_incentives_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_qr_codes" ADD CONSTRAINT "team_qr_codes_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_leader_id_users_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_escalations" ADD CONSTRAINT "ticket_escalations_inquiry_id_customer_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."customer_inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_escalations" ADD CONSTRAINT "ticket_escalations_escalated_by_users_id_fk" FOREIGN KEY ("escalated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_escalations" ADD CONSTRAINT "ticket_escalations_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_escalations" ADD CONSTRAINT "ticket_escalations_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "urgent_fee_policies" ADD CONSTRAINT "urgent_fee_policies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_location_latest" ADD CONSTRAINT "user_location_latest_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_location_logs" ADD CONSTRAINT "user_location_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sanctions" ADD CONSTRAINT "user_sanctions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sanctions" ADD CONSTRAINT "user_sanctions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vat_settings" ADD CONSTRAINT "vat_settings_courier_id_courier_settings_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."courier_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vat_settings" ADD CONSTRAINT "vat_settings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virtual_accounts" ADD CONSTRAINT "virtual_accounts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virtual_accounts" ADD CONSTRAINT "virtual_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_confirmations" ADD CONSTRAINT "work_confirmations_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_confirmations" ADD CONSTRAINT "work_confirmations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_confirmations" ADD CONSTRAINT "work_confirmations_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_proof_events" ADD CONSTRAINT "work_proof_events_work_session_id_work_sessions_id_fk" FOREIGN KEY ("work_session_id") REFERENCES "public"."work_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_proof_events" ADD CONSTRAINT "work_proof_events_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_job_contract_id_job_contracts_id_fk" FOREIGN KEY ("job_contract_id") REFERENCES "public"."job_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;