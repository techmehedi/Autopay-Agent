-- Migration: Fix employee access to organizations they're members of
-- This allows employees to read organization details when they're members

-- The function user_is_employee_in_org already exists from migration 005
-- Just ensure it's up to date
CREATE OR REPLACE FUNCTION user_is_employee_in_org(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM employee_organizations
    WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission (if not already granted)
GRANT EXECUTE ON FUNCTION user_is_employee_in_org(UUID) TO authenticated;

-- Allow employees to read organizations they're members of
-- This is needed for the join query in employee dashboard
-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Employees can view organizations they're members of" ON organizations;
DROP POLICY IF EXISTS "Users can view member organizations" ON organizations;

-- Recreate the member organizations policy to include employees
CREATE POLICY "Users can view member organizations"
  ON organizations FOR SELECT
  USING (
    -- Allow if user is owner
    owner_id = auth.uid() OR
    -- Allow if user is employee member (using the existing function)
    user_is_employee_in_org(id)
  );

