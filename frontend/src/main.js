import Vue from 'vue'
import App from './App.vue'
import ElementUI from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';
import axios from 'axios'
import 'leaflet/dist/leaflet.css';

Vue.config.productionTip = false
Vue.use(ElementUI);

// 🔥 核心修正：本地运行必须用 localhost:8081
// 注意：后端 application.yml 里配置了 /cauvisitor，所以这里也要带上
// 修改 axios 的默认地址
axios.defaults.baseURL = '/cauvisitor';

Vue.prototype.$axios = axios;

new Vue({
  render: h => h(App),
}).$mount('#app')