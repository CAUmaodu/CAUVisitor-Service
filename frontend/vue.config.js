const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  lintOnSave: false,
  publicPath: '/',
  devServer: {
    port: 8080,
    proxy: {
      '/cauvisitor': {
        target: 'http://localhost:8081',
        changeOrigin: true
      }
    }
  }
})
