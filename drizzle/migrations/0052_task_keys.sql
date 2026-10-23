ALTER TABLE "boards" ADD COLUMN "key" varchar(10) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "task_seq" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "number" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
WITH k AS (
  SELECT id, workspace_id, created_at,
    COALESCE(NULLIF(upper(left(regexp_replace(name, '[^[:alnum:]]', '', 'g'), 3)), ''), 'BRD') AS base
  FROM boards
), r AS (
  SELECT id, base, row_number() OVER (PARTITION BY workspace_id, base ORDER BY created_at, id) AS rn FROM k
)
UPDATE boards b SET key = CASE WHEN r.rn = 1 THEN r.base ELSE r.base || r.rn END FROM r WHERE b.id = r.id;--> statement-breakpoint
UPDATE tasks t SET number = n.rn
FROM (SELECT id, row_number() OVER (PARTITION BY board_id ORDER BY created_at, id) AS rn FROM tasks) n
WHERE t.id = n.id;--> statement-breakpoint
UPDATE boards b SET task_seq = COALESCE((SELECT max(number) FROM tasks WHERE board_id = b.id), 0);--> statement-breakpoint
CREATE UNIQUE INDEX "boards_workspace_key_idx" ON "boards" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_board_number_idx" ON "tasks" USING btree ("board_id","number");--> statement-breakpoint
-- '' / 0 are "assign for me" markers, so every insert path (service, seed, tests) gets a key and a number.
CREATE FUNCTION boards_assign_key() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  base text;
  candidate text;
  i int := 2;
BEGIN
  IF NEW.key <> '' THEN
    RETURN NEW;
  END IF;
  base := COALESCE(NULLIF(upper(left(regexp_replace(NEW.name, '[^[:alnum:]]', '', 'g'), 3)), ''), 'BRD');
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM boards WHERE workspace_id = NEW.workspace_id AND key = candidate) LOOP
    candidate := base || i;
    i := i + 1;
  END LOOP;
  NEW.key := candidate;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER boards_assign_key BEFORE INSERT ON boards FOR EACH ROW EXECUTE FUNCTION boards_assign_key();--> statement-breakpoint
-- The UPDATE row-locks the board, so concurrent inserts on one board get distinct numbers.
CREATE FUNCTION tasks_assign_number() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.number = 0 THEN
    UPDATE boards SET task_seq = task_seq + 1 WHERE id = NEW.board_id RETURNING task_seq INTO NEW.number;
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER tasks_assign_number BEFORE INSERT ON tasks FOR EACH ROW EXECUTE FUNCTION tasks_assign_number();
