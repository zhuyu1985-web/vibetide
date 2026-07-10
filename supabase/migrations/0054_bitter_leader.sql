ALTER TABLE "user_profiles" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_phone_unique" UNIQUE("phone");