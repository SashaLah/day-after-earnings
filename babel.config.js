module.exports = {
    presets: [
      ['@babel/preset-env', {
        targets: {
          node: '18'
        }
      }],
      ['@babel/preset-react', {
        runtime: 'automatic'
      }]
    ],
    plugins: [
      ['@babel/plugin-transform-runtime', {
        regenerator: true
      }]
    ]
  };