import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reimburse.me - AI-Powered Employee Reimbursement',
  description: 'Automate expense claims and pay employees instantly with AI-powered reimbursement SaaS',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-animated text-slate-100">
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(600px_circle_at_50%_-20%,rgba(63,81,181,0.35),transparent_70%)]" />
          {children}
        </div>
      </body>
    </html>
  );
}

