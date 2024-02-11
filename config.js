function getPublicPath() {
    switch (process.env.NODE_ENV) {
        case 'production':
            return '/web-midifile-performer/';
        default:
            return '/';
    }
}

module.exports = {
    publicPath: getPublicPath()
}