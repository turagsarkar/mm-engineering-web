-- migration_004_testing_fixes.sql
-- Fixes: admin role showing as member, blank leaderboard, blank activity panel,
--        supplier traffic_light from priority_rank, brand review_disabled column,
--        price comparison RLS, priority_tasks RLS

-- ============================================================
-- 1. PROFILES: Drop all SELECT policies and recreate cleanly
-- Allows every authenticated user to read profiles
-- (required for own role to load + leaderboard/activity joins)
-- ============================================================
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "profiles_authenticated_select" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Recreate is_admin with SET row_security = off to avoid recursion
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET row_security = off
AS $$
BEGIN
  RETURN (SELECT role = 'admin' FROM profiles WHERE id = auth.uid());
END;
$$;

-- ============================================================
-- 2. ACTIVITY_LOG: Allow all authenticated users to read
-- ============================================================
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'activity_log' AND schemaname = 'public' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON activity_log', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "activity_log_authenticated_select" ON activity_log
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 3. PRIORITY_TASKS: Allow all authenticated users to read/write
-- ============================================================
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'priority_tasks' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON priority_tasks', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "priority_tasks_authenticated_select" ON priority_tasks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "priority_tasks_admin_insert" ON priority_tasks
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "priority_tasks_authenticated_update" ON priority_tasks
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 4. PRICE_COMPARISONS: Allow all authenticated users to read
-- ============================================================
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'price_comparisons' AND schemaname = 'public' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON price_comparisons', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "price_comparisons_authenticated_select" ON price_comparisons
  FOR SELECT USING (auth.uid() IS NOT NULL);

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'price_comparison_lines' AND schemaname = 'public' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON price_comparison_lines', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "price_comparison_lines_authenticated_select" ON price_comparison_lines
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 5. BRANDS: Add review_disabled column
-- ============================================================
ALTER TABLE brands ADD COLUMN IF NOT EXISTS review_disabled BOOLEAN DEFAULT FALSE NOT NULL;

-- ============================================================
-- 6. SUPPLIERS: Sync traffic_light from priority_rank
-- Fixes imported data that only has numeric priority_rank
-- ============================================================
UPDATE suppliers
SET traffic_light = CASE
  WHEN priority_rank = 1 THEN 'green'
  WHEN priority_rank = 2 THEN 'amber'
  WHEN priority_rank >= 3 THEN 'red'
  ELSE 'green'
END
WHERE traffic_light IS NULL OR traffic_light = '';
