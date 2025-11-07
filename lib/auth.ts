import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { createSupabaseServerClient } from './supabase/client';
import { Database } from './supabase/database.types';

type Organization = Database['public']['Tables']['organizations']['Row'];
type Employee = Database['public']['Tables']['employees']['Row'];
type Claim = Database['public']['Tables']['claims']['Row'];

export type AccountType = 'admin' | 'employee';

export interface UserProfile {
  id: string;
  account_type: AccountType;
  created_at: string;
  updated_at: string;
}

export async function getCurrentUser() {
  const supabase = createClientComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getUserAccountType(): Promise<AccountType | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = createClientComponentClient();
  const { data } = await supabase
    .from('user_profiles')
    .select('account_type')
    .eq('id', user.id)
    .single();

  return data?.account_type || null;
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = createClientComponentClient();
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return data;
}

export async function setUserAccountType(accountType: AccountType): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) {
    console.error('No user found when setting account type');
    return false;
  }

  const supabase = createClientComponentClient();
  
  // Try to insert first, if it fails (duplicate), then update
  const { data: existing } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  if (existing) {
    // Update existing profile
    const { error } = await supabase
      .from('user_profiles')
      .update({ account_type: accountType })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating account type:', error);
      return false;
    }
    return true;
  } else {
    // Insert new profile
    const { error } = await supabase
      .from('user_profiles')
      .insert({
        id: user.id,
        account_type: accountType,
      });

    if (error) {
      console.error('Error inserting account type:', error);
      // Check if it's a table doesn't exist error
      if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        console.error('The user_profiles table does not exist. Please run the migration 005_add_account_types_and_join_codes.sql');
      }
      return false;
    }
    return true;
  }
}

export async function getCurrentOrganization(): Promise<Organization | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = createClientComponentClient();
  const accountType = await getUserAccountType();
  
  // If account type is not set yet, try employee first (more common for new users)
  if (!accountType || accountType === 'employee') {
    // For employees: Get organization from employee_organizations
    const { data: empOrg, error: empOrgError } = await supabase
      .from('employee_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (empOrg && !empOrgError) {
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', empOrg.organization_id)
        .single();
      
      if (orgData && !orgError) {
        return orgData;
      }
    }
    
    // If employee path didn't work and account type is employee, return null
    if (accountType === 'employee') {
      return null;
    }
  }
  
  // For admins or if account type is null and employee path failed
  if (!accountType || accountType === 'admin') {
    // For admins: First try to get organization where user is owner
    let { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('owner_id', user.id)
      .limit(1)
      .maybeSingle();

    // If not found, check if user is a member
    if (error || !data) {
      const { data: memberData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (memberData) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', memberData.organization_id)
          .single();
        
        return orgData;
      }
    }

    return data;
  }

  return null;
}

export async function getUserOrganizations(): Promise<Organization[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = createClientComponentClient();
  const accountType = await getUserAccountType();

  if (accountType === 'admin') {
    // Get organizations where user is owner
    const { data: ownedOrgs } = await supabase
      .from('organizations')
      .select('*')
      .eq('owner_id', user.id);

    // Get organizations where user is a member
    const { data: memberData } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id);

    if (memberData && memberData.length > 0) {
      const orgIds = memberData.map(m => m.organization_id);
      const { data: memberOrgs } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds);

      // Combine and deduplicate
      const allOrgs = [...(ownedOrgs || []), ...(memberOrgs || [])];
      const uniqueOrgs = Array.from(
        new Map(allOrgs.map(org => [org.id, org])).values()
      );
      return uniqueOrgs;
    }

    return ownedOrgs || [];
  } else if (accountType === 'employee') {
    // For employees: Get organizations from employee_organizations
    const { data: empOrgs } = await supabase
      .from('employee_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (empOrgs && empOrgs.length > 0) {
      const orgIds = empOrgs.map(eo => eo.organization_id);
      const { data: orgs } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds);

      return orgs || [];
    }
  }

  return [];
}

export async function getOrganizationEmployees(
  organizationId: string
): Promise<Employee[]> {
  const supabase = createClientComponentClient();
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data;
}

export async function getOrganizationClaims(
  organizationId: string,
  limit = 50
): Promise<Claim[]> {
  const supabase = createClientComponentClient();
  const { data, error } = await supabase
    .from('claims')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data;
}

