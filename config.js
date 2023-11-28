function getPublicPath() {
    switch (process.env.NODE_ENV) {
        case 'production':
            return '/midifile-performer-web/';
        default:
            return '/';
    }
}

module.exports = {
    publicPath: getPublicPath()
}