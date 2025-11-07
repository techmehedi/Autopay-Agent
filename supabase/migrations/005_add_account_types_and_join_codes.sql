-- Migration: Add account types, join codes, and employee-organization relationships
-- This enables separate admin and employee accounts with organization join functionality

-- Add account_type to user metadata (we'll use auth.users.raw_user_meta_data)
-- Note: Supabase doesn't allow direct ALTER to auth.users, so we'll use a separate table
-- or store it in user metadata. For now, we'll create a user_profiles table.

-- Create user_profiles table to store account type and other user-specific data
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL CHECK (account_type IN ('admin', 'employee')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(id)
);

-- Add join_code to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS join_code TEXT UNIQUE;

-- Create function to generate unique join codes
CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate a 8-character alphanumeric code
    code := UPPER(
      SUBSTRING(
        MD5(RANDOM()::TEXT || NOW()::TEXT),
        1,
        8
      )
    );
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM organizations WHERE join_code = code) INTO exists_check;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT exists_check;
  END LOOP;
  
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Add employee_organizations junction table for employees to join organizations
CREATE TABLE IF NOT EXISTS employee_organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'inactive')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

-- Create index for employee_organizations
CREATE INDEX IF NOT EXISTS idx_employee_orgs_user ON employee_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_orgs_org ON employee_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_employee_orgs_status ON employee_organizations(status);

-- Enable RLS on new tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_organizations ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_profiles
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- RLS policies for employee_organizations
-- Employees can view their own organization memberships
CREATE POLICY "Employees can view their own organization memberships"
  ON employee_organizations FOR SELECT
  USING (user_id = auth.uid());

-- Employees can join organizations (insert pending status)
CREATE POLICY "Employees can request to join organizations"
  ON employee_organizations FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can view all employee_organizations in their organizations
CREATE POLICY "Admins can view employee memberships in their organizations"
  ON employee_organizations FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

-- Admins can update employee_organizations in their organizations
CREATE POLICY "Admins can manage employee memberships in their organizations"
  ON employee_organizations FOR UPDATE
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

-- Update employees table to better link to users
-- Add index for user_id if not exists
CREATE INDEX IF NOT EXISTS idx_employees_user ON employees(user_id);

-- Update RLS policies for employees to allow employees to view/update their own record
DROP POLICY IF EXISTS "Employees can view their own employee record" ON employees;
CREATE POLICY "Employees can view their own employee record"
  ON employees FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Employees can update their own employee record" ON employees;
CREATE POLICY "Employees can update their own employee record"
  ON employees FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Update claims RLS to allow employees to view/create their own claims
DROP POLICY IF EXISTS "Employees can view their own claims" ON claims;
CREATE POLICY "Employees can view their own claims"
  ON claims FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Employees can create their own claims" ON claims;
CREATE POLICY "Employees can create their own claims"
  ON claims FOR INSERT
  WITH CHECK (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

-- Function to automatically generate join code when organization is created
CREATE OR REPLACE FUNCTION generate_org_join_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.join_code IS NULL OR NEW.join_code = '' THEN
    NEW.join_code := generate_join_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate join code
DROP TRIGGER IF EXISTS auto_generate_join_code ON organizations;
CREATE TRIGGER auto_generate_join_code
  BEFORE INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION generate_org_join_code();

-- Function to update updated_at for new tables
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Helper function to get user account type
CREATE OR REPLACE FUNCTION get_user_account_type(user_uuid UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT account_type FROM user_profiles WHERE id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_user_account_type(UUID) TO authenticated;

-- Helper function to check if user is employee in organization
CREATE OR REPLACE FUNCTION user_is_employee_in_org(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM employee_organizations 
    WHERE user_id = auth.uid() 
      AND organization_id = org_id 
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION user_is_employee_in_org(UUID) TO authenticated;

