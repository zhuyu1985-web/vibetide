ALTER TABLE "user_profiles" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "password_hash_algo" text DEFAULT 'argon2id';--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_email_unique" UNIQUE("email");
