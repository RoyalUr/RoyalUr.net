const path = require("path"),
      TerserPlugin = require("terser-webpack-plugin"),
      ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

/** Returns an absolute path of a file relative to this config. **/
function abs(...args) {
    return path.resolve.apply(this, [__dirname].concat(args));
}

/** Joins several relative file pieces into one relative file path. **/
function rel(...args) {
    return "./" + path.join.apply(this, args);
}

module.exports = {
    output: {
        path: abs('build', 'js')
    },
    resolve: {
        alias: {
            '@': abs('src')
        }
    },
    entry: {
        home: {
            import:  rel('src', 'home', 'home.ts'),
            filename: rel('index.js')
        },
        game: {
            import:  rel('src', 'game', 'client.ts'),
            filename: rel('game', 'index.js')
        },
        gameWorker: {
            import:  rel('src', 'game', 'game', 'ai_worker.ts'),
            filename: rel('game', 'ai_worker.ts')
        },
        gameResources: {
            import:  rel('src', 'game', 'game_resources.ts'),
            filename: rel('game', 'resources.js')
        },
        articles: {
            import:  rel('src', 'articles', 'base', 'articles.ts'),
            filename: rel('articles.ts')
        },
        dice: {
            import:  rel('src', 'articles', 'learn', 'dice.ts'),
            filename: rel('dice', 'index.js')
        }
    },
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    mangle: false
                }
            })

        ]
    },
    plugins: [
        new ForkTsCheckerWebpackPlugin(),
    ],
    module: {
        rules: [
            {
                test: /\.(ts|js)?$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["@babel/preset-env", "@babel/preset-typescript"],
                        transpileOnly: true
                    },
                },
            },
        ],
    },
};
