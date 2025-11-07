# Setup Guide

## Quick Start

### 1. Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be fully provisioned (usually 1-2 minutes)
3. Go to Settings > API and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

### 2. Run Database Migration

1. In Supabase, go to SQL Editor
2. Click "New query"
3. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
4. Paste and run the migration
5. Verify tables were created in the Table Editor

### 3. Environment Variables

Create `.env.local` in the project root:

```bash
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Anthropic AI (required)
ANTHROPIC_API_KEY=your-anthropic-api-key

# Locus (optional - can be set per organization in dashboard)
LOCUS_CLIENT_ID=your-locus-client-id
LOCUS_CLIENT_SECRET=your-locus-client-secret
LOCUS_MCP_URL=https://mcp.paywithlocus.com/mcp
```

### 4. Install and Run

```bash
npm install
npm run dev
```

Visit http://localhost:3000 and sign up!

## First Time Setup in App

1. **Sign Up**: Create an account at `/auth/signin`
2. **You'll be automatically redirected** to the dashboard
3. **Create Organization** (if needed): Go to Settings and create your organization
4. **Add Employees**: Go to Employees → Add Employee
5. **Connect Locus**: In Settings, add your Locus credentials
6. **Set Policies**: Configure reimbursement limits in Settings
7. **Submit Claims**: Start submitting expense claims!

## Troubleshooting

### "Organization not found"
- Make sure you've run the database migration
- Check that RLS policies are enabled in Supabase
- Verify your user is the owner or member of an organization

### "Locus payment failed"
- Verify Locus credentials in Settings
- Check that the employee has a valid wallet address or email
- Ensure Locus MCP URL is correct

### Authentication issues
- Clear browser cookies and try again
- Check Supabase project is active
- Verify environment variables are set correctly

