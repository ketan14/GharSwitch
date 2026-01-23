const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ["@ghar-switch/domain-types", "@ghar-switch/constants"],
    output: 'standalone',
};

module.exports = nextConfig;
