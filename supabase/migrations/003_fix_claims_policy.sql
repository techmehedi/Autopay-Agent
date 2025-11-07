-- Quick fix for claims INSERT policy
-- Run this if you're still getting "permission denied for table users" when creating claims

-- Drop the old policy if it exists
DROP POLICY IF EXISTS "Employees can create claims" ON claims;
DROP POLICY IF EXISTS "Users can create claims" ON claims;

-- Create the new policy without auth.users reference
CREATE POLICY "Users can create claims"
  ON claims FOR INSERT
  WITH CHECK (
    -- Allow organization owners to create claims for any employee in their org
    organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
  );

