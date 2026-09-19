-- Data repair. The constraints below are only addable once existing rows satisfy
-- them, so backfill first. Every statement is a no-op on a clean database.
UPDATE "books" SET "total_copies" = 1 WHERE "total_copies" IS NULL;--> statement-breakpoint
UPDATE "books" SET "available_copies" = COALESCE("available_copies", "total_copies");--> statement-breakpoint
UPDATE "books" SET "is_active" = true WHERE "is_active" IS NULL;--> statement-breakpoint
UPDATE "books" SET "available_copies" = 0 WHERE "available_copies" < 0;--> statement-breakpoint
UPDATE "books" SET "available_copies" = "total_copies" WHERE "available_copies" > "total_copies";--> statement-breakpoint
UPDATE "users" SET "role" = 'student' WHERE "role" IS NULL OR "role" NOT IN ('student', 'faculty', 'librarian', 'admin');--> statement-breakpoint
UPDATE "fines" SET "is_paid" = false WHERE "is_paid" IS NULL;--> statement-breakpoint
UPDATE "reservations" SET "status" = 'active' WHERE "status" IS NULL;--> statement-breakpoint
-- 'overdue' was a third status the old code could write. Overdue-ness is derived
-- from due_date, not stored, so those rows are just active loans.
UPDATE "borrowings" SET "status" = 'borrowed' WHERE "status" IS NULL OR "status" NOT IN ('borrowed', 'returned');--> statement-breakpoint
UPDATE "borrowings" SET "returned_at" = COALESCE("returned_at", now()) WHERE "status" = 'returned';--> statement-breakpoint
UPDATE "borrowings" SET "status" = 'returned' WHERE "status" = 'borrowed' AND "returned_at" IS NOT NULL;--> statement-breakpoint
-- Collapse pre-existing duplicate active loans (which the application-level
-- check could not prevent) down to the earliest one per (user, book).
UPDATE "borrowings" SET "status" = 'returned', "returned_at" = now()
WHERE "status" = 'borrowed' AND "id" NOT IN (
  SELECT MIN("id") FROM "borrowings" WHERE "status" = 'borrowed' GROUP BY "user_id", "book_id"
);--> statement-breakpoint
ALTER TABLE "books" ALTER COLUMN "total_copies" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "books" ALTER COLUMN "available_copies" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "books" ALTER COLUMN "is_active" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "borrowings" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fines" ALTER COLUMN "is_paid" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "books_active_title_idx" ON "books" USING btree ("is_active","title");--> statement-breakpoint
CREATE INDEX "books_active_category_title_idx" ON "books" USING btree ("is_active","category_id","title");--> statement-breakpoint
CREATE UNIQUE INDEX "borrowings_one_active_loan_per_user_book" ON "borrowings" USING btree ("user_id","book_id") WHERE "borrowings"."status" = 'borrowed';--> statement-breakpoint
CREATE INDEX "borrowings_user_status_idx" ON "borrowings" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "borrowings_book_status_idx" ON "borrowings" USING btree ("book_id","status");--> statement-breakpoint
CREATE INDEX "fines_user_unpaid_idx" ON "fines" USING btree ("user_id","is_paid");--> statement-breakpoint
CREATE INDEX "reservations_user_status_idx" ON "reservations" USING btree ("user_id","status");--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_total_copies_positive" CHECK ("books"."total_copies" >= 0);--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_available_copies_non_negative" CHECK ("books"."available_copies" >= 0);--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_available_lte_total" CHECK ("books"."available_copies" <= "books"."total_copies");--> statement-breakpoint
ALTER TABLE "borrowings" ADD CONSTRAINT "borrowings_status_valid" CHECK ("borrowings"."status" in ('borrowed', 'returned'));--> statement-breakpoint
ALTER TABLE "borrowings" ADD CONSTRAINT "borrowings_returned_at_matches_status" CHECK (("borrowings"."status" = 'returned') = ("borrowings"."returned_at" is not null));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_valid" CHECK ("users"."role" in ('student', 'faculty', 'librarian', 'admin'));