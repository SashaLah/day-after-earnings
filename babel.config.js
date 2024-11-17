module.exports = {
    presets: [
      ['@babel/preset-env', {
        targets: {
          node: '18',
          browsers: ['>0.25%', 'not ie 11', 'not op_mini all']
        }
      }],
      ['@babel/preset-react', {
        runtime: 'automatic'
      }]
    ],
    plugins: [
      '@babel/plugin-transform-runtime'
    ]
  };