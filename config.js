function getPublicPath() {
    switch (process.env.NODE_ENV) {
        case 'production':
            return '/web-midifile-performer-dev/';
        default:
            return '/';
    }
}

module.exports = {
    publicPath: getPublicPath()
}