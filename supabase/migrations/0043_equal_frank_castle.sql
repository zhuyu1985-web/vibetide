ALTER TABLE "cms_publications" DROP CONSTRAINT "cms_publications_article_id_articles_id_fk";
--> statement-breakpoint
ALTER TABLE "external_publications" DROP CONSTRAINT "external_publications_article_id_articles_id_fk";
--> statement-breakpoint
ALTER TABLE "cms_publications" ADD CONSTRAINT "cms_publications_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_publications" ADD CONSTRAINT "external_publications_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;