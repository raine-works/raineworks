-- ==========================================================================
-- LISTEN/NOTIFY infrastructure for cross-instance change awareness.
--
-- This file is fully self-contained — it creates both PL/pgSQL functions
-- and attaches triggers to every table in the schema. All statements are
-- idempotent (CREATE OR REPLACE / DROP IF EXISTS) so this script is safe
-- to run repeatedly.
--
-- Run manually:   bun run db:triggers
-- Run with init:  bun run db:dev
--
-- ==========================================================================
-- Table classification
--
-- The schema contains two categories of tables. This classification
-- determines which tables receive NOTIFY, audit (history/trash), and
-- cron-based cleanup treatment.
--
--   PERSISTENT — long-lived domain entities that represent durable state.
--     Receive NOTIFY triggers (cross-instance awareness) and audit
--     triggers (change_log on UPDATE, deleted_records on DELETE).
--
--     User, Post, Account, Passkey,
--     OAuthClient, OAuthScope, OAuthConsent
--
--   EPHEMERAL — short-lived, single-use artefacts with an `expiresAt`
--     column. These are high-volume, transient rows (tokens, challenges,
--     codes) that are consumed or expire quickly. They do NOT receive
--     NOTIFY or audit triggers — tracking their changes would generate
--     noise and bloat the audit tables. Instead, a daily cron job
--     purges expired rows.
--
--     OtpCode, RefreshToken, PasskeyChallenge,
--     OAuthAuthorizationCode, OAuthAccessToken, OAuthRefreshToken
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Core trigger function
-- --------------------------------------------------------------------------
-- Fires pg_notify on INSERT/UPDATE/DELETE with a lightweight JSON payload
-- under the 'table_change' channel. Keeps payloads small: operation +
-- primary key + metadata only. Consumers fetch full row data via Prisma
-- if needed.
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_table_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  record_id TEXT;
BEGIN
  -- Resolve the primary key from the correct record
  IF (TG_OP = 'DELETE') THEN
    record_id := OLD.id::TEXT;
  ELSE
    record_id := NEW.id::TEXT;
  END IF;

  payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'operation', TG_OP,
    'id', record_id,
    'timestamp', extract(epoch from now())::bigint
  );

  PERFORM pg_notify('table_change', payload::TEXT);

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------------------------
-- 2. Helper: attach the notify trigger to any table by name
--    Usage:  SELECT attach_notify_trigger('MyNewTable');
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION attach_notify_trigger(target_table TEXT)
RETURNS VOID AS $$
DECLARE
  trigger_name TEXT := target_table || '_notify_change';
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS %I ON %I;'
    ' CREATE TRIGGER %I'
    ' AFTER INSERT OR UPDATE OR DELETE ON %I'
    ' FOR EACH ROW EXECUTE FUNCTION notify_table_change();',
    trigger_name, target_table, trigger_name, target_table
  );
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------------------------
-- 2b. Helper: detach the notify trigger from a table (cleanup)
--     Usage:  SELECT detach_notify_trigger('SomeEphemeralTable');
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION detach_notify_trigger(target_table TEXT)
RETURNS VOID AS $$
DECLARE
  trigger_name TEXT := target_table || '_notify_change';
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS %I ON %I;',
    trigger_name, target_table
  );
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------------------------
-- 3. Attach NOTIFY triggers to PERSISTENT tables only
-- --------------------------------------------------------------------------

SELECT attach_notify_trigger('User');
SELECT attach_notify_trigger('Post');
SELECT attach_notify_trigger('Account');
SELECT attach_notify_trigger('Passkey');
SELECT attach_notify_trigger('OAuthClient');
SELECT attach_notify_trigger('OAuthScope');
SELECT attach_notify_trigger('OAuthConsent');

-- --------------------------------------------------------------------------
-- 3b. Detach NOTIFY triggers from EPHEMERAL tables
--     (cleanup — these were attached in earlier versions of this script)
-- --------------------------------------------------------------------------

SELECT detach_notify_trigger('OtpCode');
SELECT detach_notify_trigger('RefreshToken');
SELECT detach_notify_trigger('PasskeyChallenge');
SELECT detach_notify_trigger('OAuthAuthorizationCode');
SELECT detach_notify_trigger('OAuthAccessToken');
SELECT detach_notify_trigger('OAuthRefreshToken');

-- ==========================================================================
-- AUDIT infrastructure — history tracking & soft-delete (trash).
--
-- A single `audit` schema contains two tables:
--
--   audit.change_log      — column-level changes on UPDATE
--   audit.deleted_records — full row snapshots on DELETE
--
-- Only PERSISTENT tables receive audit triggers. Ephemeral tables are
-- excluded — their high churn would bloat the audit tables with noise
-- that has no long-term value.
--
-- Actor resolution:
--
--   Every history and trash row records WHO performed the action via
--   the `changed_by` / `deleted_by` column. The value is resolved by
--   the `resolve_actor()` helper function:
--
--   1. If the API server set `app.current_user_id` via SET LOCAL (the
--      `withActor()` helper in `@rainestack/database/actor`), the value
--      is the authenticated user's CUID — e.g. "cm3abc123def456".
--
--   2. Otherwise, the value falls back to `session_user` — the
--      PostgreSQL role name (e.g. "postgres"). This covers migrations,
--      CLI sessions, cron jobs, and manual psql queries.
--
--   Consumers can distinguish the two cases by format: CUIDs are 25+
--   character alphanumeric strings starting with a letter, while
--   PostgreSQL role names are typically short lowercase identifiers.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 4. Audit schema
-- --------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS audit;

-- --------------------------------------------------------------------------
-- 5. Actor resolution helper
-- --------------------------------------------------------------------------
-- Determines who initiated the current database operation.
--
-- Priority:
--   1. app.current_user_id — set by the API server's withActor()
--      helper via SET LOCAL inside an interactive transaction.
--      Contains the authenticated user's CUID.
--
--   2. session_user — the PostgreSQL role that opened the connection.
--      This is the fallback for migrations, CLI tools, cron jobs,
--      and any operation where the app did not set the variable.
--
-- The `current_setting(name, missing_ok)` overload with `true`
-- returns NULL instead of throwing when the GUC has never been set
-- in the current session. This is critical for connections that
-- never call SET LOCAL (e.g. psql, Prisma CLI).
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION resolve_actor()
RETURNS TEXT AS $$
DECLARE
  actor TEXT;
BEGIN
  actor := current_setting('app.current_user_id', true);

  IF actor IS NULL OR actor = '' THEN
    actor := session_user;
  END IF;

  RETURN actor;
END;
$$ LANGUAGE plpgsql STABLE;

-- --------------------------------------------------------------------------
-- 6. Table: audit.change_log
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit.change_log (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id       TEXT        NOT NULL,
  table_name      TEXT        NOT NULL,
  changed_columns TEXT[]      NOT NULL,
  old_values      JSONB       NOT NULL,
  new_values      JSONB       NOT NULL,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by      TEXT
);

CREATE INDEX IF NOT EXISTS idx_change_log_table_record
  ON audit.change_log (table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_change_log_changed_by
  ON audit.change_log (changed_by);

-- --------------------------------------------------------------------------
-- 7. Table: audit.deleted_records
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit.deleted_records (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id       TEXT        NOT NULL,
  table_name      TEXT        NOT NULL,
  record_data     JSONB       NOT NULL,
  deleted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_by      TEXT
);

CREATE INDEX IF NOT EXISTS idx_deleted_records_table_record
  ON audit.deleted_records (table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_deleted_records_deleted_by
  ON audit.deleted_records (deleted_by);

-- --------------------------------------------------------------------------
-- 8. Trigger function: track_row_changes()
--    Fires AFTER UPDATE — records only the columns that actually changed.
--    Resolves the actor via resolve_actor() and stores it in changed_by.
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION track_row_changes()
RETURNS TRIGGER AS $$
DECLARE
  col          TEXT;
  old_json     JSONB := to_jsonb(OLD);
  new_json     JSONB := to_jsonb(NEW);
  cols_changed TEXT[] := '{}';
  old_vals     JSONB := '{}';
  new_vals     JSONB := '{}';
  actor        TEXT;
BEGIN
  FOR col IN
    SELECT column_name
      FROM information_schema.columns
     WHERE table_schema = TG_TABLE_SCHEMA
       AND table_name   = TG_TABLE_NAME
  LOOP
    IF old_json -> col IS DISTINCT FROM new_json -> col THEN
      cols_changed := array_append(cols_changed, col);
      old_vals := old_vals || jsonb_build_object(col, old_json -> col);
      new_vals := new_vals || jsonb_build_object(col, new_json -> col);
    END IF;
  END LOOP;

  -- Nothing actually changed — skip the insert
  IF array_length(cols_changed, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  actor := resolve_actor();

  INSERT INTO audit.change_log
    (record_id, table_name, changed_columns, old_values, new_values, changed_by)
  VALUES
    (NEW.id::TEXT, TG_TABLE_NAME, cols_changed, old_vals, new_vals, actor);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------------------------
-- 9. Trigger function: trash_deleted_row()
--     Fires BEFORE DELETE — snapshots the full row into audit.
--     Resolves the actor via resolve_actor() and stores it in deleted_by.
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trash_deleted_row()
RETURNS TRIGGER AS $$
DECLARE
  actor TEXT;
BEGIN
  actor := resolve_actor();

  INSERT INTO audit.deleted_records
    (record_id, table_name, record_data, deleted_by)
  VALUES
    (OLD.id::TEXT, TG_TABLE_NAME, to_jsonb(OLD), actor);

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------------------------
-- 10. Helper: attach history trigger to any table (idempotent)
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION attach_history_trigger(target_table TEXT)
RETURNS VOID AS $$
DECLARE
  trigger_name TEXT := target_table || '_track_changes';
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS %I ON %I;'
    ' CREATE TRIGGER %I'
    ' AFTER UPDATE ON %I'
    ' FOR EACH ROW EXECUTE FUNCTION track_row_changes();',
    trigger_name, target_table, trigger_name, target_table
  );
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------------------------
-- 11. Helper: attach trash trigger to any table (idempotent)
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION attach_trash_trigger(target_table TEXT)
RETURNS VOID AS $$
DECLARE
  trigger_name TEXT := target_table || '_trash_deleted';
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS %I ON %I;'
    ' CREATE TRIGGER %I'
    ' BEFORE DELETE ON %I'
    ' FOR EACH ROW EXECUTE FUNCTION trash_deleted_row();',
    trigger_name, target_table, trigger_name, target_table
  );
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------------------------
-- 12. Attach history & trash triggers to PERSISTENT tables only
-- --------------------------------------------------------------------------

-- History (UPDATE tracking)
SELECT attach_history_trigger('User');
SELECT attach_history_trigger('Post');
SELECT attach_history_trigger('Account');
SELECT attach_history_trigger('Passkey');
SELECT attach_history_trigger('OAuthClient');
SELECT attach_history_trigger('OAuthScope');
SELECT attach_history_trigger('OAuthConsent');

-- Trash (DELETE soft-delete)
SELECT attach_trash_trigger('User');
SELECT attach_trash_trigger('Post');
SELECT attach_trash_trigger('Account');
SELECT attach_trash_trigger('Passkey');
SELECT attach_trash_trigger('OAuthClient');
SELECT attach_trash_trigger('OAuthScope');
SELECT attach_trash_trigger('OAuthConsent');

-- ==========================================================================
-- EPHEMERAL record cleanup — daily purge of expired rows.
--
-- Ephemeral tables store short-lived, single-use artefacts (tokens,
-- challenges, OTP codes) that become worthless after their `expiresAt`
-- timestamp passes. Left uncollected, these rows accumulate
-- indefinitely and waste storage, degrade index performance, and
-- slow down sequential scans.
--
-- The purge function deletes expired rows from every ephemeral table
-- in a single call and returns a summary of how many rows were removed
-- per table.
--
-- Scheduling:
--
--   The function is registered as a pg_cron job that runs daily at
--   03:00 UTC. If the pg_cron extension is not available (e.g. the
--   PostgreSQL instance does not have it installed), registration is
--   skipped gracefully — the function still exists and can be called
--   manually or via an application-level scheduler:
--
--     SELECT * FROM purge_expired_ephemeral_records();
--
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 13. Purge function: purge_expired_ephemeral_records()
--     Deletes all rows past their `expiresAt` from every ephemeral table.
--     Returns a summary table of (table_name, rows_deleted) for logging.
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION purge_expired_ephemeral_records()
RETURNS TABLE(purged_table TEXT, rows_deleted BIGINT) AS $$
DECLARE
  _count BIGINT;
BEGIN
  -- OtpCode — one-time passcodes (typically 5–10 min TTL)
  DELETE FROM "OtpCode" WHERE "expiresAt" < now();
  GET DIAGNOSTICS _count = ROW_COUNT;
  IF _count > 0 THEN
    purged_table := 'OtpCode';
    rows_deleted := _count;
    RETURN NEXT;
  END IF;

  -- RefreshToken — JWT refresh tokens (typically 24 h TTL)
  -- Purge tokens that have both expired AND been revoked, or simply expired.
  DELETE FROM "RefreshToken" WHERE "expiresAt" < now();
  GET DIAGNOSTICS _count = ROW_COUNT;
  IF _count > 0 THEN
    purged_table := 'RefreshToken';
    rows_deleted := _count;
    RETURN NEXT;
  END IF;

  -- PasskeyChallenge — WebAuthn ceremony challenges (typically 5 min TTL)
  DELETE FROM "PasskeyChallenge" WHERE "expiresAt" < now();
  GET DIAGNOSTICS _count = ROW_COUNT;
  IF _count > 0 THEN
    purged_table := 'PasskeyChallenge';
    rows_deleted := _count;
    RETURN NEXT;
  END IF;

  -- OAuthAuthorizationCode — authorization codes (typically 10 min TTL)
  DELETE FROM "OAuthAuthorizationCode" WHERE "expiresAt" < now();
  GET DIAGNOSTICS _count = ROW_COUNT;
  IF _count > 0 THEN
    purged_table := 'OAuthAuthorizationCode';
    rows_deleted := _count;
    RETURN NEXT;
  END IF;

  -- OAuthAccessToken — bearer tokens (typically 1 h TTL)
  DELETE FROM "OAuthAccessToken" WHERE "expiresAt" < now();
  GET DIAGNOSTICS _count = ROW_COUNT;
  IF _count > 0 THEN
    purged_table := 'OAuthAccessToken';
    rows_deleted := _count;
    RETURN NEXT;
  END IF;

  -- OAuthRefreshToken — OAuth refresh tokens (typically 30–90 day TTL)
  DELETE FROM "OAuthRefreshToken" WHERE "expiresAt" < now();
  GET DIAGNOSTICS _count = ROW_COUNT;
  IF _count > 0 THEN
    purged_table := 'OAuthRefreshToken';
    rows_deleted := _count;
    RETURN NEXT;
  END IF;

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------------------------
-- 14. pg_cron: register daily purge job
--
--     Requires the pg_cron extension to be loaded via
--     shared_preload_libraries in postgresql.conf (or Docker command).
--     If pg_cron is not available, registration is silently skipped
--     and a NOTICE is raised suggesting manual or app-level scheduling.
-- --------------------------------------------------------------------------

DO $cron$
BEGIN
  -- Attempt to enable pg_cron in this database.
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  -- Remove any previously-registered version of this job so the
  -- schedule is always up-to-date with this script.
  PERFORM cron.unschedule(jobid)
    FROM cron.job
   WHERE jobname = 'purge-expired-ephemeral-records';

  -- Schedule the purge to run daily at 03:00 UTC.
  -- The cron expression: minute=0, hour=3, day=*, month=*, dow=*
  PERFORM cron.schedule(
    'purge-expired-ephemeral-records',
    '0 3 * * *',
    $$SELECT * FROM purge_expired_ephemeral_records()$$
  );

  RAISE NOTICE '[database] pg_cron job registered: purge-expired-ephemeral-records (daily at 03:00 UTC)';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[database] pg_cron is not available — skipping cron job registration (%). Call purge_expired_ephemeral_records() manually or via an application-level scheduler.', SQLERRM;
END;
$cron$;
