import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/**
 * Get the current user's organization (where they are owner or member)
 * This avoids the complex OR query with subquery that PostgREST doesn't support
 */
export async function getUserOrganization(supabase: ReturnType<typeof createClientComponentClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // First try to get organization where user is owner
  let { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('owner_id', user.id)
    .limit(1)
    .single();

  // If not found, check if user is a member
  if (error || !data) {
    const { data: memberData } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

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

