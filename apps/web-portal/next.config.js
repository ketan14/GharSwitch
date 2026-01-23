/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ["@ghar-switch/domain-types", "@ghar-switch/constants"],
};

module.exports = nextConfig;
