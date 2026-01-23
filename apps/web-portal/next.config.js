const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ["@ghar-switch/domain-types", "@ghar-switch/constants"],
    output: 'standalone',
    // Moved to root level as experimental.outputFileTracingRoot is deprecated
    outputFileTracingRoot: path.join(__dirname, '../../'),
};

module.exports = nextConfig;
