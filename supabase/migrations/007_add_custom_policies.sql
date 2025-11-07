-- Migration: Add custom policies table for organization-specific rules
-- Allows admins to create custom policies that the agent must check

CREATE TABLE IF NOT EXISTS custom_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'amount_limit',
    'category_restriction',
    'time_restriction',
    'employee_restriction',
    'purpose_restriction',
    'custom_condition'
  )),
  rule_config JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_custom_policies_org ON custom_policies(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_policies_active ON custom_policies(organization_id, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_custom_policies_priority ON custom_policies(organization_id, priority DESC);

-- Enable RLS
ALTER TABLE custom_policies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can view custom policies in their organizations
CREATE POLICY "Admins can view custom policies in their organizations"
  ON custom_policies FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

-- Admins can create custom policies in their organizations
CREATE POLICY "Admins can create custom policies in their organizations"
  ON custom_policies FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

-- Admins can update custom policies in their organizations
CREATE POLICY "Admins can update custom policies in their organizations"
  ON custom_policies FOR UPDATE
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

-- Admins can delete custom policies in their organizations
CREATE POLICY "Admins can delete custom policies in their organizations"
  ON custom_policies FOR DELETE
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

-- Trigger to update updated_at
CREATE TRIGGER update_custom_policies_updated_at
  BEFORE UPDATE ON custom_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON custom_policies TO authenticated;

