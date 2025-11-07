-- Fix RLS policies and add slug availability function
-- Run this migration if you already ran 001_initial_schema.sql
-- This fixes the infinite recursion issue in RLS policies

-- Function to check if slug is available (bypasses RLS for availability check)
CREATE OR REPLACE FUNCTION check_slug_available(slug_to_check TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM organizations WHERE slug = slug_to_check
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_slug_available(TEXT) TO authenticated;

-- Helper function to check if user is member of organization (avoids recursion)
CREATE OR REPLACE FUNCTION user_is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members 
    WHERE organization_id = org_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION user_is_org_member(UUID) TO authenticated;

-- Drop existing policies to recreate them without recursion
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Users can update their organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;
DROP POLICY IF EXISTS "Users can add themselves as members" ON organization_members;
DROP POLICY IF EXISTS "Users can view employees in their organizations" ON employees;
DROP POLICY IF EXISTS "Users can manage employees in their organizations" ON employees;
DROP POLICY IF EXISTS "Users can view claims in their organizations" ON claims;
DROP POLICY IF EXISTS "Employees can create claims" ON claims;
DROP POLICY IF EXISTS "Users can create claims" ON claims;
DROP POLICY IF EXISTS "Users can update claims" ON claims;
DROP POLICY IF EXISTS "Users can view policies in their organizations" ON policies;
DROP POLICY IF EXISTS "Admins can manage policies" ON policies;

-- Recreate organizations policies WITHOUT recursion
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (owner_id = auth.uid());

-- Allow users to see organizations where they are members (using function to avoid recursion)
CREATE POLICY "Users can view member organizations"
  ON organizations FOR SELECT
  USING (user_is_org_member(id));

CREATE POLICY "Users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their organizations"
  ON organizations FOR UPDATE
  USING (owner_id = auth.uid());

-- Organization members policies (simplified)
CREATE POLICY "Users can view members of their organizations"
  ON organization_members FOR SELECT
  USING (
    user_id = auth.uid() OR
    organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can add themselves as members"
  ON organization_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
  );

-- Employees policies (simplified to avoid recursion)
CREATE POLICY "Users can view employees in their organizations"
  ON employees FOR SELECT
  USING (
    organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can manage employees in their organizations"
  ON employees FOR ALL
  USING (
    organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
  );

-- Claims policies
CREATE POLICY "Users can view claims in their organizations"
  ON claims FOR SELECT
  USING (
    organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can create claims"
  ON claims FOR INSERT
  WITH CHECK (
    -- Allow organization owners to create claims for any employee in their org
    organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can update claims"
  ON claims FOR UPDATE
  USING (
    organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
  );

-- Policies policies
CREATE POLICY "Users can view policies in their organizations"
  ON policies FOR SELECT
  USING (
    organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
  );

CREATE POLICY "Admins can manage policies"
  ON policies FOR ALL
  USING (
    organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
  );

