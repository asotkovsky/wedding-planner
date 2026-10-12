ALTER TABLE "guests" ADD COLUMN "plus_one_of" uuid;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_plus_one_of_guests_id_fk" FOREIGN KEY ("plus_one_of") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "guests_plus_one_of_uq" ON "guests" USING btree ("plus_one_of");--> statement-breakpoint
-- Link existing plus-ones to guests invited by name in their household, pairing them in order.
WITH plus_ones AS (
  SELECT id, household_id, row_number() OVER (PARTITION BY household_id ORDER BY sort_order, created_at) AS n
  FROM guests WHERE is_plus_one = true AND plus_one_of IS NULL
), hosts AS (
  SELECT id, household_id, row_number() OVER (PARTITION BY household_id ORDER BY sort_order, created_at) AS n
  FROM guests WHERE is_plus_one = false AND first_name IS NOT NULL
)
UPDATE guests SET plus_one_of = hosts.id
FROM plus_ones JOIN hosts ON hosts.household_id = plus_ones.household_id AND hosts.n = plus_ones.n
WHERE guests.id = plus_ones.id;
