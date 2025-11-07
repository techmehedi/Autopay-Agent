-- Migration: Fix RLS policies to allow employees to create their own records
-- This enables employees to join organizations and create their employee records

-- Drop conflicting policies first (from migration 002)
DROP POLICY IF EXISTS "Users can view employees in their organizations" ON employees;
DROP POLICY IF EXISTS "Users can manage employees in their organizations" ON employees;

-- Allow employees to INSERT their own employee record when joining an organization
-- This is critical for the join flow
DROP POLICY IF EXISTS "Employees can create their own employee record" ON employees;
CREATE POLICY "Employees can create their own employee record"
  ON employees FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Ensure employees can view their own employee record
DROP POLICY IF EXISTS "Employees can view their own employee record" ON employees;
CREATE POLICY "Employees can view their own employee record"
  ON employees FOR SELECT
  USING (user_id = auth.uid());

-- Ensure employees can update their own employee record (e.g., wallet address)
DROP POLICY IF EXISTS "Employees can update their own employee record" ON employees;
CREATE POLICY "Employees can update their own employee record"
  ON employees FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can still view and manage employees in their organizations
CREATE POLICY "Admins can view employees in their organizations"
  ON employees FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage employees in their organizations"
  ON employees FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

-- Ensure employees can view their own organization memberships
DROP POLICY IF EXISTS "Employees can view their own organization memberships" ON employee_organizations;
CREATE POLICY "Employees can view their own organization memberships"
  ON employee_organizations FOR SELECT
  USING (user_id = auth.uid());

-- Ensure employees can create their own organization memberships (join)
DROP POLICY IF EXISTS "Employees can request to join organizations" ON employee_organizations;
CREATE POLICY "Employees can request to join organizations"
  ON employee_organizations FOR INSERT
  WITH CHECK (user_id = auth.uid());

