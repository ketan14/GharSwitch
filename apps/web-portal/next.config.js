const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ["@ghar-switch/domain-types", "@ghar-switch/constants"],
    output: 'standalone',
    experimental: {
        // Required for monorepos to trace dependencies correctly
        outputFileTracingRoot: path.join(__dirname, '../../'),
    },
};

module.exports = nextConfig;
