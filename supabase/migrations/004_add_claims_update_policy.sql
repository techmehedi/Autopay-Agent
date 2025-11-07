-- Add UPDATE policy for claims so status can be updated after processing
-- Run this if claims status isn't updating

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can update claims" ON claims;

-- Allow organization owners to update claims in their organization
CREATE POLICY "Users can update claims"
  ON claims FOR UPDATE
  USING (
    organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
  );

