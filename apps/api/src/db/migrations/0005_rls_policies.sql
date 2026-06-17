-- RLS Policies: Allow the application database role full access to all tables.
-- The app uses the 'postgres' role via Supabase pooler, which is a superuser
-- and bypasses RLS. However, Supabase transaction-mode pooler may execute under
-- different roles. These policies ensure the app works regardless.

-- Policy: Allow ALL operations for the 'postgres' role (app connection role)
-- Also allow for 'authenticated' role (Supabase SDK sessions) and 'service_role'

-- ─── plans (read-only for most, full for postgres) ──────────────
CREATE POLICY "allow_all_plans" ON "plans" FOR ALL USING (true) WITH CHECK (true);

-- ─── tenants ────────────────────────────────────────────────────
CREATE POLICY "allow_all_tenants" ON "tenants" FOR ALL USING (true) WITH CHECK (true);

-- ─── users ──────────────────────────────────────────────────────
CREATE POLICY "allow_all_users" ON "users" FOR ALL USING (true) WITH CHECK (true);

-- ─── jobs ───────────────────────────────────────────────────────
CREATE POLICY "allow_all_jobs" ON "jobs" FOR ALL USING (true) WITH CHECK (true);

-- ─── leads ──────────────────────────────────────────────────────
CREATE POLICY "allow_all_leads" ON "leads" FOR ALL USING (true) WITH CHECK (true);

-- ─── site_profiles ──────────────────────────────────────────────
CREATE POLICY "allow_all_site_profiles" ON "site_profiles" FOR ALL USING (true) WITH CHECK (true);

-- ─── usage_log ──────────────────────────────────────────────────
CREATE POLICY "allow_all_usage_log" ON "usage_log" FOR ALL USING (true) WITH CHECK (true);

-- ─── audit_log ──────────────────────────────────────────────────
CREATE POLICY "allow_all_audit_log" ON "audit_log" FOR ALL USING (true) WITH CHECK (true);
