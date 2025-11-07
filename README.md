# Reimburse.me - Full-Stack Reimbursement SaaS

Reimburse.me is a modern, AI-powered employee reimbursement SaaS platform that businesses use to automate expense claims and pay employees instantly via Locus payments.

## Features

- **AI-Powered Processing**: Automatically process and approve expense claims using Claude AI
- **Multi-Tenant Architecture**: Each business has its own organization with employees and policies
- **Locus Integration**: Connect to Locus for instant USDC payments to employees
- **Policy Management**: Customizable per-transaction, daily, and monthly limits
- **Employee Management**: Add and manage team members with wallet addresses or emails
- **Real-time Dashboard**: Track claims, payments, and analytics
- **Modern UI**: Beautiful interface built with Aceternity UI patterns and Framer Motion

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI**: Anthropic Claude via LangChain
- **Payments**: Locus MCP (Machine Control Protocol)
- **UI Components**: Aceternity UI patterns, Framer Motion, Lucide Icons

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key from Settings > API
3. Get your service role key from Settings > API (keep this secret!)

### 3. Run Database Migrations

Run the SQL migration file in your Supabase SQL Editor:

```bash
# Copy the contents of supabase/migrations/001_initial_schema.sql
# and run it in your Supabase SQL Editor
```

### 4. Configure Environment Variables

Create `.env.local` in the project root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Anthropic AI
ANTHROPIC_API_KEY=your_anthropic_api_key

# Locus (optional - can be set per organization in settings)
LOCUS_CLIENT_ID=your_locus_client_id
LOCUS_CLIENT_SECRET=your_locus_client_secret
LOCUS_MCP_URL=https://mcp.paywithlocus.com/mcp

# Optional chain hints
LOCUS_CHAIN=base
LOCUS_NETWORK=mainnet
```

### 5. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the landing page.

## Getting Started

1. **Sign Up**: Create an account at `/auth/signin`
2. **Create Organization**: On first login, you'll be prompted to create an organization
3. **Add Employees**: Go to Employees and add team members with their email and optional wallet address
4. **Connect Locus**: In Settings, add your Locus Client ID and Secret
5. **Configure Policies**: Set per-transaction, daily, and monthly limits
6. **Submit Claims**: Employees can submit expense claims that are automatically processed by AI

## Project Structure

```
app/
  dashboard/          # Dashboard pages (protected)
    employees/        # Employee management
    claims/          # Claims management
    settings/        # Organization settings
  auth/              # Authentication pages
  page.tsx           # Landing page

components/
  ui/                # Reusable UI components
    navbar.tsx       # Navigation bar
    animated-card.tsx # Animated card component

lib/
  supabase/          # Supabase client utilities
  auth.ts            # Authentication helpers
  agent.ts           # AI agent for processing claims
  mcpClient.ts       # Locus MCP client

pages/
  api/
    claim.ts         # Claim processing API (multi-tenant)

supabase/
  migrations/        # Database migrations
```

## Database Schema

- **organizations**: Business organizations
- **organization_members**: Multi-user organization support
- **employees**: Team members who can submit claims
- **claims**: Expense claims with status and processing results
- **policies**: Organization-specific reimbursement policies

## API Reference

### POST `/api/claim`

Process a new expense claim.

**Request:**
```json
{
  "claim_id": "uuid",
  "organization_id": "uuid",
  "employee_id": "uuid",
  "amount": 50.00,
  "purpose": "Team lunch",
  "recipient": "employee@example.com"
}
```

**Response:**
```json
{
  "status": "approved",
  "amount": 50.00,
  "purpose": "Team lunch",
  "txId": "tx_...",
  "decision": "approve",
  "confidence": 0.95,
  "explanations": [...]
}
```

## Security

- Row Level Security (RLS) enabled on all tables
- Organization-based access control
- Secure credential storage (Locus secrets encrypted at rest)
- Authentication required for all dashboard routes

## Development

```bash
# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start
```

## Deployment

1. Deploy to Vercel, Netlify, or your preferred platform
2. Set environment variables in your deployment platform
3. Ensure Supabase project is accessible
4. Run migrations in production Supabase instance

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
