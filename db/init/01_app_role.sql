-- Postgres entrypoint init: makes the scrumban role respect Row-Level
-- Security policies. Without this, the role is created as SUPERUSER and
-- BYPASSRLS would silently disable our tenant isolation in dev.
--
-- Runs only on first DB initialization (when the data volume is empty).
ALTER ROLE scrumban NOBYPASSRLS;
