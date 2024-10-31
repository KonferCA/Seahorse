/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config, { isServer, dev }) => {
        config.experiments = {
            ...config.experiments,
            asyncWebAssembly: true,
            layers: true,
        };
        
        config.output = {
            ...config.output,
            webassemblyModuleFilename: 'static/wasm/[modulehash].wasm',
        };

        // Add WASM file handling
        config.module.rules.push({
            test: /\.wasm$/,
            type: "asset/resource"
        })

        return config;
    },

    output: 'standalone',
};

module.exports = nextConfig;
