/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config, { isServer }) => {
        config.experiments = {
            ...config.experiments,
            asyncWebAssembly: true,
        };
        
        config.output = {
            ...config.output,
            webassemblyModuleFilename: isServer
                ? './../static/wasm/[modulehash].wasm'
                : 'static/wasm/[modulehash].wasm',
        };

        // Add WASM file handling
        config.module.rules.push({
            test: /\.wasm$/,
            type: "asset/resource"
        })

        return config;
    },
};

module.exports = nextConfig;
