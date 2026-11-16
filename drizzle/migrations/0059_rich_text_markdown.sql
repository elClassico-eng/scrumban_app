CREATE OR REPLACE FUNCTION plain_to_markdown(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN t LIKE '%```%' THEN t ELSE regexp_replace(
    replace(t, E'\r\n', E'\n'),
    E'(?<![\\n\\\\])\\n(?!\\n|$|[ \\t]*([-*+]|\\d+[.)]|>|#{1,6})[ \\t])',
    E'\\\\\n',
    'g'
  ) END
$$;
--> statement-breakpoint
UPDATE tasks SET description = plain_to_markdown(description) WHERE description LIKE E'%\n%';
--> statement-breakpoint
UPDATE task_comments SET body = plain_to_markdown(body) WHERE body LIKE E'%\n%';
