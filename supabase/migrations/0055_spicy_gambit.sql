ALTER TABLE "user_profiles" DROP CONSTRAINT "user_profiles_phone_unique";--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "phone_hash" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_phone_hash_unique" UNIQUE("phone_hash");