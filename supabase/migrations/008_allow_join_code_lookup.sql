-- Migration: Allow employees to lookup organizations by join code
-- This enables employees to verify join codes before joining an organization

-- Create a function to check organization by join code (returns only basic info needed for join)
-- This function bypasses RLS to allow employees to verify join codes
CREATE OR REPLACE FUNCTION get_org_by_join_code(join_code_to_check TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  join_code TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.name, o.join_code
  FROM organizations o
  WHERE o.join_code = join_code_to_check
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_org_by_join_code(TEXT) TO authenticated;

-- Note: We'll use the RPC function for join code lookups instead of direct queries
-- This is more secure and bypasses RLS issues. The function approach is preferred.
-- If needed, we can add a policy later, but the function should work for now.

