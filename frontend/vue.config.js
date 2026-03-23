const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  lintOnSave: false,
  publicPath: '/',
  devServer: {
    proxy: {
      '/cauvisitor': {
        target: 'http://localhost:8081',
        changeOrigin: true
      }
    }
  }
})
