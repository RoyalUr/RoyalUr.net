const path = require("path"),
      TerserPlugin = require("terser-webpack-plugin");

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
    entry: {
        home: {
            import:  rel('src', 'home', 'home.js'),
            filename: rel('index.js')
        },
        game: {
            import:  rel('src', 'game', 'client.js'),
            filename: rel('game', 'index.js')
        },
        gameWorker: {
            import:  rel('src', 'game', 'game', 'computer_worker.js'),
            filename: rel('game', 'computer_worker.js')
        },
        gameResources: {
            import:  rel('src', 'game', 'game_resources.js'),
            filename: rel('game', 'resources.js')
        },
        articles: {
            import:  rel('src', 'articles', 'base', 'articles.js'),
            filename: rel('articles.js')
        },
        dice: {
            import:  rel('src', 'articles', 'learn', 'dice.js'),
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
};
