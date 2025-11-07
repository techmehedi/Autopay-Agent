/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    LOCUS_CLIENT_ID: process.env.LOCUS_CLIENT_ID,
    LOCUS_CLIENT_SECRET: process.env.LOCUS_CLIENT_SECRET,
    LOCUS_MCP_URL: process.env.LOCUS_MCP_URL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    WHITELISTED_CONTACT: process.env.WHITELISTED_CONTACT,
    PER_TXN_MAX: process.env.PER_TXN_MAX,
    DAILY_MAX: process.env.DAILY_MAX,
  },
};

module.exports = nextConfig;

