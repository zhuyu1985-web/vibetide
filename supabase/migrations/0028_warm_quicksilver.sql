CREATE UNIQUE INDEX "ai_employees_org_slug_uidx" ON "ai_employees" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_skills_employee_skill_uidx" ON "employee_skills" USING btree ("employee_id","skill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "skills_org_name_uidx" ON "skills" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_knowledge_bases_employee_kb_uidx" ON "employee_knowledge_bases" USING btree ("employee_id","knowledge_base_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_bases_org_name_uidx" ON "knowledge_bases" USING btree ("organization_id","name");