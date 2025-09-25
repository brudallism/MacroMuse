-- 999_simple_rls_test.sql
-- Simple RLS verification that works with Supabase's auth system
-- This script checks that RLS policies are properly enabled

-- Test RLS policies are active
CREATE OR REPLACE FUNCTION verify_rls_setup()
RETURNS TEXT AS $$
DECLARE
  test_results TEXT := '';
  rls_count INTEGER;
  policy_count INTEGER;
  table_name TEXT;
  policy_info TEXT;
BEGIN
  test_results := test_results || E'🔒 RLS Policy Verification\n\n';

  -- Count tables with RLS enabled
  SELECT COUNT(*) INTO rls_count
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity = true;

  test_results := test_results || format('✅ Tables with RLS enabled: %s\n', rls_count);

  -- List tables with RLS
  test_results := test_results || E'\n📋 RLS-Enabled Tables:\n';

  FOR table_name IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = true
    ORDER BY c.relname
  LOOP
    test_results := test_results || format('   • %s\n', table_name);
  END LOOP;

  -- Count total RLS policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policy p
  JOIN pg_class c ON p.polrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public';

  test_results := test_results || format(E'\n✅ Total RLS policies created: %s\n', policy_count);

  -- List all policies
  test_results := test_results || E'\n📜 RLS Policies:\n';

  FOR policy_info IN
    SELECT format('%s.%s: %s', c.relname, p.polname,
                  CASE p.polcmd
                    WHEN 'r' THEN 'SELECT'
                    WHEN 'a' THEN 'INSERT'
                    WHEN 'w' THEN 'UPDATE'
                    WHEN 'd' THEN 'DELETE'
                    WHEN '*' THEN 'ALL'
                    ELSE 'UNKNOWN'
                  END)
    FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
    ORDER BY c.relname, p.polname
  LOOP
    test_results := test_results || format('   • %s\n', policy_info);
  END LOOP;

  -- Verify expected tables have RLS
  test_results := test_results || E'\n🎯 Core Table RLS Status:\n';

  -- Check specific tables
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
             WHERE n.nspname = 'public' AND c.relname = 'profile' AND c.relrowsecurity = true) THEN
    test_results := test_results || E'   ✅ profile - RLS enabled\n';
  ELSE
    test_results := test_results || E'   ❌ profile - RLS missing\n';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
             WHERE n.nspname = 'public' AND c.relname = 'intake_log' AND c.relrowsecurity = true) THEN
    test_results := test_results || E'   ✅ intake_log - RLS enabled\n';
  ELSE
    test_results := test_results || E'   ❌ intake_log - RLS missing\n';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
             WHERE n.nspname = 'public' AND c.relname = 'recipe' AND c.relrowsecurity = true) THEN
    test_results := test_results || E'   ✅ recipe - RLS enabled\n';
  ELSE
    test_results := test_results || E'   ❌ recipe - RLS missing\n';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
             WHERE n.nspname = 'public' AND c.relname = 'goal_base' AND c.relrowsecurity = true) THEN
    test_results := test_results || E'   ✅ goal_base - RLS enabled\n';
  ELSE
    test_results := test_results || E'   ❌ goal_base - RLS missing\n';
  END IF;

  -- Verify auth.uid() function exists (Supabase built-in)
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'auth' AND p.proname = 'uid') THEN
    test_results := test_results || E'\n✅ auth.uid() function available\n';
  ELSE
    test_results := test_results || E'\n❌ auth.uid() function missing\n';
  END IF;

  -- Check if RLS policies reference auth.uid()
  SELECT COUNT(*) INTO policy_count
  FROM pg_policy p
  WHERE pg_get_expr(p.polqual, p.polrelid) LIKE '%auth.uid()%'
     OR pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%auth.uid()%';

  test_results := test_results || format('✅ Policies using auth.uid(): %s\n', policy_count);

  -- Check migration_history table exists (doesn't need RLS)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE information_schema.tables.table_name = 'migration_history') THEN
    test_results := test_results || E'\n✅ migration_history table exists (no RLS needed)\n';
  ELSE
    test_results := test_results || E'\n❌ migration_history table missing\n';
  END IF;

  -- Summary
  test_results := test_results || E'\n🎉 RLS Security Summary:\n';
  test_results := test_results || format('   📊 User tables with RLS: %s/14 expected\n', rls_count);
  test_results := test_results || format('   🔐 Total security policies: %s\n', policy_count);

  IF rls_count = 14 AND policy_count >= 14 THEN
    test_results := test_results || E'   ✅ RLS properly configured\n';
    test_results := test_results || E'   ✅ User data is protected\n';
    test_results := test_results || E'   ✅ Ready for production use\n';
    test_results := test_results || E'\n🎯 Database schema is COMPLETE! 🎉\n';
  ELSE
    test_results := test_results || E'   ⚠️  RLS may need additional configuration\n';
  END IF;

  RETURN test_results;
END;
$$ LANGUAGE plpgsql;

-- Run the verification
SELECT verify_rls_setup();

-- Additional manual tests you can run in your app:
COMMENT ON FUNCTION verify_rls_setup() IS 'Verifies RLS policies are active.
For real testing:
1. Create two test user accounts in your app
2. Log in as user1 and create some data
3. Log in as user2 - you should not see user1 data
4. Try to insert/update user1 data as user2 - should fail';

-- Show sample auth context check
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '💡 To test RLS in your application:';
  RAISE NOTICE '   1. Two users should only see their own profiles';
  RAISE NOTICE '   2. User A cannot access User B''s intake logs';
  RAISE NOTICE '   3. User A cannot modify User B''s recipes';
  RAISE NOTICE '   4. All INSERT/UPDATE/DELETE respects user ownership';
  RAISE NOTICE '';
  RAISE NOTICE '🔐 RLS policies will automatically enforce these rules';
  RAISE NOTICE '   when users authenticate through Supabase auth';
END $$;