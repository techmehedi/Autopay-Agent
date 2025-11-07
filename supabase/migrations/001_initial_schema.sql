-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  locus_client_id TEXT,
  locus_client_secret TEXT,
  locus_mcp_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization members (for multi-user orgs)
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Employees table
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  wallet_address TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, email)
);

-- Policies table
CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  per_txn_max NUMERIC(10, 2) NOT NULL DEFAULT 0.50,
  daily_max NUMERIC(10, 2) NOT NULL DEFAULT 3.00,
  monthly_max NUMERIC(10, 2),
  whitelisted_contacts TEXT[] DEFAULT '{}',
  default_contact TEXT,
  auto_approve BOOLEAN DEFAULT false,
  require_approval BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id)
);

-- Claims table
CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  purpose TEXT NOT NULL,
  recipient TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  decision TEXT CHECK (decision IN ('approve', 'deny', 'review')),
  confidence NUMERIC(3, 2),
  reason TEXT,
  tx_id TEXT,
  trace_id TEXT,
  explanations JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_organizations_owner ON organizations(owner_id);
CREATE INDEX idx_organization_members_org ON organization_members(organization_id);
CREATE INDEX idx_organization_members_user ON organization_members(user_id);
CREATE INDEX idx_employees_org ON employees(organization_id);
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_claims_org ON claims(organization_id);
CREATE INDEX idx_claims_employee ON claims(employee_id);
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_claims_created ON claims(created_at DESC);
CREATE INDEX idx_policies_org ON policies(organization_id);

-- RLS (Row Level Security) policies
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

-- Functions must be created before policies that use them
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

-- Organizations RLS: Users can see organizations they own or are members of
-- Note: We use separate policies to avoid infinite recursion
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

-- Organization members RLS
-- Simplified to avoid recursion - users can see members of orgs they own or are members of
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

-- Employees RLS (simplified to avoid recursion)
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

-- Claims RLS (simplified to avoid recursion)
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

-- Policies RLS (simplified to avoid recursion)
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

-- Function to automatically create policy for new organization
CREATE OR REPLACE FUNCTION create_default_policy()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO policies (organization_id, per_txn_max, daily_max)
  VALUES (NEW.id, 0.50, 3.00);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_policy_on_org_creation
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION create_default_policy();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policies_updated_at
  BEFORE UPDATE ON policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

