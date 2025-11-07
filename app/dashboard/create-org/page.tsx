'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { AnimatedCard } from '@/components/ui/animated-card';
import { Building2, Save, Copy, Check } from 'lucide-react';

export default function CreateOrganizationPage() {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdOrg, setCreatedOrg] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData({
      name,
      slug: generateSlug(name),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('You must be logged in');
        return;
      }

      // Check if slug is available using database function
      const { data: slugAvailable, error: slugError } = await supabase
        .rpc('check_slug_available', { slug_to_check: formData.slug });

      if (slugError) {
        console.error('Error checking slug:', slugError);
        // Continue anyway - the unique constraint will catch duplicates
      } else if (slugAvailable === false) {
        setError('This organization name is already taken. Please choose another.');
        return;
      }

      // Create organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: formData.name,
          slug: formData.slug,
          owner_id: user.id,
        })
        .select()
        .single();

      if (orgError) {
        console.error('Organization creation error:', orgError);
        // Check if it's a duplicate slug error
        if (orgError.code === '23505' || orgError.message.includes('duplicate') || orgError.message.includes('unique')) {
          setError('This organization name is already taken. Please choose another.');
        } else {
          setError(orgError.message || 'Failed to create organization. Please try again.');
        }
        return;
      }

      // Add user as member
      await supabase.from('organization_members').insert({
        organization_id: orgData.id,
        user_id: user.id,
        role: 'owner',
      });

      // Fetch the created organization to get the join code
      const { data: finalOrg } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgData.id)
        .single();

      setCreatedOrg(finalOrg);
    } catch (err: any) {
      setError(err.message || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Create Organization</h1>
        <p className="text-slate-300">
          Create your organization to start managing employee reimbursements
        </p>
      </div>

      {createdOrg ? (
        <AnimatedCard>
          <div className="text-center py-8">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
                <Check className="h-8 w-8 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Organization Created!</h2>
              <p className="text-slate-300">{createdOrg.name}</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Employee Join Code
              </label>
              <div className="flex items-center gap-3">
                <code className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-lg tracking-wider text-center">
                  {createdOrg.join_code}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(createdOrg.join_code);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  title="Copy code"
                >
                  {copied ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Copy className="h-5 w-5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-3">
                Share this code with employees so they can join your organization
              </p>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </AnimatedCard>
      ) : (
        <AnimatedCard>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Organization Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Acme Inc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                URL Slug *
              </label>
              <input
                type="text"
                required
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: generateSlug(e.target.value) })
                }
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                placeholder="acme-inc"
              />
              <p className="text-xs text-slate-400 mt-1">
                This will be used in your organization URL
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-5 w-5 mr-2" />
                {loading ? 'Creating...' : 'Create Organization'}
              </button>
            </div>
          </form>
        </AnimatedCard>
      )}
    </div>
  );
}

