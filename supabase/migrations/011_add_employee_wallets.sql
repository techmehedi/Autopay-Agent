-- Migration: Add employee wallets table for multiple wallets per employee

CREATE TABLE IF NOT EXISTS employee_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  label TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id, address)
);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_employee_wallets_updated_at
  BEFORE UPDATE ON employee_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE employee_wallets ENABLE ROW LEVEL SECURITY;

-- Employeaes can manage their own wallets
CREATE POLICY "Employees can view their wallets"
  ON employee_wallets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Employees can insert their wallets"
  ON employee_wallets FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Employees can update their wallets"
  ON employee_wallets FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Employees can delete their wallets"
  ON employee_wallets FOR DELETE
  USING (user_id = auth.uid());


