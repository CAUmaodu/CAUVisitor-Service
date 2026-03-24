const { defineConfig } = require('@vue/cli-service')

const port = process.env.VUE_APP_PORT || 8080;

module.exports = defineConfig({
  transpileDependencies: true,
  lintOnSave: false,
  publicPath: '/',
  devServer: {
    port: port,
    proxy: {
      '/cauvisitor': {
        target: 'http://localhost:8081',
        changeOrigin: true
      }
    }
  }
})
