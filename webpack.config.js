const path = require('path');

module.exports = {
  entry: {
    popup: ['./csv-exporter.js', './library-detector.js', './popup.js'],
    content: ['./library-detector.js', './content.js'],
    background: './background.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  resolve: {
    extensions: ['.js']
  },
  mode: 'development',
  devtool: 'source-map'
};
