const webpack = require('webpack');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const pjson = require('./package.json');

const OUTPUT_DIR = path.resolve(__dirname, 'bundle');

module.exports = {
    entry: {
        index: './src/index.ts',
    },
    output: {
        path: OUTPUT_DIR,
        filename: '[name].js',
        libraryTarget: 'commonjs2'
    },
    mode: 'production',
    devtool: 'source-map',
    target: 'node',
    node: false, // Don't mess with any node built-ins or globals
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            },
            {
                // Required to build .mjs files correctly
                test: /\.mjs$/,
                include: /node_modules/,
                type: "javascript/auto",
            },
            {
                test: /node_modules[\\|/]simple-plist[\\|/]dist/,
                use: { loader: 'umd-compat-loader' }
            },
            {
                // Some browser launchers (Opera) use resource files from within the browser-launcher
                // module. We need to reroute that to point to the unbundled files:
                test: /node_modules\/@httptoolkit\/browser-launcher\/lib\/run.js$/,
                loader: 'string-replace-loader',
                options: {
                    search: '../res/',
                    replace: './bl-resources/',
                    flags: 'g',
                    strict: true
                }
            }
        ]
    },
    externals: [
        '@oclif/plugin-update/lib/commands/update', // Lots of complicated dynamic requires in @oclif
        'registry-js', // Native module
        'win-version-info', // Native module
        'node-datachannel', // Native module
        '_stream_wrap', // Used in httpolyglot only in old Node, where it's available
        function (context, request, callback) {
            if (context !== __dirname && request.endsWith('/error-tracking')) {
                // Direct all requires of error-tracking to its entrypoint at the top level,
                // except the root require that actually builds the entrypoint.
                callback(null, 'commonjs ./error-tracking');
            } else {
                callback();
            }
        }
    ],
    plugins: [
        // Optimistic require for 'iconv' in 'encoding', falls back to 'iconv-lite'
        new webpack.NormalModuleReplacementPlugin(/\/iconv-loader$/, /node-noop/),
        // Optimistically required in (various) ws versions, with fallback
        new webpack.IgnorePlugin({ resourceRegExp: /^bufferutil$/ }),
        // Optimistically required in (various) ws versions, with fallback
        new webpack.IgnorePlugin({ resourceRegExp: /^utf-8-validate$/ }),
        // Optimistically required in headless, falls back to child_process
        new webpack.IgnorePlugin({ resourceRegExp: /^child-killer$/ }),
        // GraphQL playground - never used
        new webpack.NormalModuleReplacementPlugin(/^\.\/renderGraphiQL$/, 'node-noop'),
        // SSH2 - used within Dockerode, but we don't support it and it has awkward native deps
        new webpack.NormalModuleReplacementPlugin(/^ssh2$/, 'node-noop'),
        // CDP protocol - not used without local:true (which we never use, we always
        // get the CDP protocol details from the target Electron app).
        new webpack.IgnorePlugin({
            resourceRegExp: /^\.\/protocol.json$/,
            contextRegExp: /chrome-remote-interface/
        }),
        // Copy Mockttp's schema (read with readFile) into the output directory
        new CopyWebpackPlugin({
            patterns: [{
                from: path.join('node_modules', '@httptoolkit', 'browser-launcher', 'res'),
                to: 'bl-resources'
            }]
        }),
        // Used to e.g. fix the relative path to the overrides directory
        new webpack.EnvironmentPlugin({ HTK_IS_BUNDLED: true })
    ],
    resolve: {
        extensions: [ '.tsx', '.ts', '.mjs', '.js' ]
    }
};
