<template>
  <el-container class="app-wrapper" :class="currentTheme">
    <el-header height="60px" class="cau-header">
      <div class="logo-area">
        <span class="system-title">中国农业大学东校区游客导览系统</span>
      </div>

      <div class="header-right">
        <div class="weather-info" v-if="weatherText" @click="fetchWeather" :style="{ color: topMenuTextColor }" title="点击刷新天气">
          <i class="el-icon-sunny"></i> {{ weatherText }}
        </div>

        <el-menu
            class="top-menu"
            mode="horizontal"
            background-color="transparent"

            :text-color="topMenuTextColor"
            :active-text-color="topMenuActiveTextColor"
            @select="handleTopMenu">
          <el-menu-item index="1"><i class="el-icon-date"></i>入校预约</el-menu-item>
          <el-menu-item index="6"><i class="el-icon-bell"></i>公告查询</el-menu-item>
          <el-menu-item index="7"><i class="el-icon-truck"></i>校车/公交</el-menu-item>
          <el-menu-item index="11"><i class="el-icon-position"></i>失物招领发布</el-menu-item>
          <el-menu-item index="10"><i class="el-icon-chat-line-square"></i>提供建议</el-menu-item>
          <el-menu-item index="9"><i class="el-icon-school"></i>学校官网</el-menu-item>
          <el-menu-item index="8"><i class="el-icon-s-custom"></i>管理员后台</el-menu-item>
        </el-menu>
      </div>
    </el-header>

    <el-container class="main-body">
      <el-aside width="240px" class="left-panel">
        <el-menu
            default-active="1"
            class="left-menu"
            :background-color="menuBgColor"
            :text-color="menuTextColor"
            :active-text-color="menuActiveTextColor">

          <el-menu-item index="map-timemachine" @click="activateTool('timemachine')" style="color: #E6A23C; font-weight: bold; border-bottom: 1px solid #e6e6e6;">
            <i class="el-icon-time"></i>
            <span slot="title">启动校园时光机</span>
          </el-menu-item>


          <el-submenu index="theme-switch">
            <template slot="title"><i class="el-icon-brush"></i>界面风格切换</template>
            <el-menu-item index="theme-default" @click="switchTheme('default')">🟢 农大绿 (默认)</el-menu-item>
            <el-menu-item index="theme-blue" @click="switchTheme('theme-blue')">🌌 科技蓝 (大屏)</el-menu-item>
            <el-menu-item index="theme-dark" @click="switchTheme('theme-dark')">🌑 深夜黑模式</el-menu-item>
          </el-submenu>


          <el-submenu index="poi">
            <template slot="title"><i class="el-icon-location"></i>兴趣点(POI)展示</template>
            <el-menu-item-group>
              <el-checkbox v-model="layers.canteen" class="layer-check" @change="toggleLayer('canteen')">食堂/餐厅</el-checkbox>
              <el-checkbox v-model="layers.scenery" class="layer-check" @change="toggleLayer('scenery')">景点(厚山等)</el-checkbox>
              <el-checkbox v-model="layers.toilet" class="layer-check" @change="toggleLayer('toilet')">公共卫生间</el-checkbox>
              <el-checkbox v-model="layers.building" class="layer-check" @change="toggleLayer('building')">教学楼</el-checkbox>
            </el-menu-item-group>
          </el-submenu>

          <el-submenu index="bus-route">
            <template slot="title"><i class="el-icon-truck"></i>校车/公交线路</template>
            <el-menu-item-group>
              <el-checkbox v-model="busLines.line1" class="layer-check" @change="toggleBus">一号环线 (红)</el-checkbox>
              <el-checkbox v-model="busLines.line2" class="layer-check" @change="toggleBus">二号环线 (绿)</el-checkbox>
              <el-checkbox v-model="busLines.houde" class="layer-check" @change="toggleBus">厚德区间 (蓝)</el-checkbox>
            </el-menu-item-group>
          </el-submenu>

          <el-submenu index="basemap">
            <template slot="title"><i class="el-icon-picture-outline"></i>底图切换</template>
            <el-menu-item index="map-day" @click="changeBaseMap('day')">
              <i class="el-icon-sunny"></i> 标准地图
            </el-menu-item>
            <el-menu-item index="map-night" @click="changeBaseMap('night')">
              <i class="el-icon-moon"></i> 夜间模式
            </el-menu-item>
            <el-menu-item index="map-sat" @click="changeBaseMap('satellite')">
              <i class="el-icon-picture"></i> 卫星影像
            </el-menu-item>
            <el-menu-item index="map-hybrid" @click="changeBaseMap('hybrid')">
              <i class="el-icon-map-location"></i> 混合路网
            </el-menu-item>
          </el-submenu>

          <el-submenu index="tools">
            <template slot="title"><i class="el-icon-s-tools"></i>地图工具箱</template>
            <el-menu-item index="measure-dist" @click="activateTool('measure')">
              <i class="el-icon-ruler"></i> 距离测量
            </el-menu-item>
            <el-menu-item index="route-plan" @click="activateTool('route')">
              <i class="el-icon-guide"></i> 简单路径规划
            </el-menu-item>
          </el-submenu>
        </el-menu>
      </el-aside>

      <el-main class="map-wrapper">
        <CampusMap ref="campusMap" @location-picked="onLocationPicked"/>
        <el-button circle icon="el-icon-aim" class="reset-btn" @click="resetMap" title="复位地图"></el-button>
      </el-main>

      <el-drawer
          :title="drawerTitle"
          :visible.sync="drawerVisible"
          direction="rtl"
          size="400px"
          custom-class="scrollable-drawer">
        <div class="drawer-content">
          <div v-if="currentDrawer === 'notice'">
            <div class="link-box-small">
              <a href="https://www.cau.edu.cn/" target="_blank" class="jump-link-small">
                <i class="el-icon-link"></i> 更多公告详情请看
              </a>
            </div>
            <el-collapse accordion>
              <el-collapse-item v-for="item in announcementList" :key="item.id" :name="item.id">
                <template slot="title">
                  <div class="notice-title-row">
                    <span class="notice-title" :title="item.title">{{ item.title }}</span>
                    <span class="notice-date">{{ item.date }}</span>
                  </div>
                </template>
                <div class="notice-body">
                  <div class="notice-meta">来源：{{ item.source }}</div>
                  <div class="notice-text">{{ item.content }}</div>
                </div>
              </el-collapse-item>
            </el-collapse>
          </div>

          <div v-if="currentDrawer === 'bus'">
            <el-alert
                title="实时查询提示"
                type="warning"
                description="具体公交运行情况请查询中国农业大学通知，校内巴士在规定路线运行"
                show-icon
                :closable="false"
                style="margin-bottom: 20px;">
            </el-alert>

            <div class="bus-list">
              <el-card shadow="hover" class="bus-card">
                <div slot="header" class="clearfix"><span style="font-weight: bold; color: #ff0000;">🚌 一号环线（外环主干线）</span></div>
                <div class="text item"><p><strong>途经站点：</strong>东门站→文科园毓秀路站→医科园仁和大道站→北门站→松园厚德站→菊园厚德站→本源体育场厚德站→荷园厚德站→柳园厚德站→南门站→工科园天健站→理科园天健站→图书馆</p><p><strong>运行时间：</strong>每日 7:20 — 21:00</p></div>
              </el-card>
              <el-card shadow="hover" class="bus-card">
                <div slot="header" class="clearfix"><span style="font-weight: bold; color: #00aa00;">🚌 二号环线（内环生活线）</span></div>
                <div class="text item"><p><strong>途经站点：</strong>东门站→文科园毓秀路站→中核毓秀路站→菊园厚德站→松园厚德站→西北门站→松园驿站→菊园餐厅站→荷园餐厅站→柳园驿站→荷园厚德站→中核培英路站→图书馆培英路站</p><p><strong>运行时间：</strong>每日 7:20 — 21:00</p></div>
              </el-card>
              <el-card shadow="hover" class="bus-card">
                <div slot="header" class="clearfix"><span style="font-weight: bold; color: #0000ff;">🚌 厚德区间</span></div>
                <div class="text item"><p><strong>途经站点：</strong>北门站→北体育馆区间→松园厚德大道站→菊园厚德大道站→本源体育场站→荷园厚德大道站→柳园厚德大道站→南门站</p><p><strong>运行时间：</strong>每日 7:20 — 21:00</p></div>
              </el-card>
            </div>
          </div>
        </div>
      </el-drawer>

      <el-dialog title="访客入校预约指南" :visible.sync="appointmentVisible" width="600px" center>
        <div class="appointment-content">
          <div class="link-box">
            <a href="https://www.cau.edu.cn/" target="_blank" class="jump-link">
              <i class="el-icon-link"></i> 点击查询具体流程
            </a>
          </div>
          <p class="intro-text">
            为了加强校园安全管理，促进学校与社会各界开展交流与合作，满足社会公众到学校参访的需求，我校于即日起将社会公众（以下简称“参访人员”）预约进校参观纳入学校访客系统，预约办理方法如下：
          </p>
          <ol class="step-list">
            <li>参访人员用手机扫描识别“参访人员预约二维码”，登记实名认证信息，或携带本人身份证件刷卡进入，详情可登录中国农业大学访客预约平台。</li>
            <li>用手机扫描识别东南门门卫处外来人员入校登记二维码，选择拟进校日期、拟参访校区，填写个人基本信息，即可生效完成预约。</li>
            <li>请在预约日期的 <strong>当天</strong> 进校，入校时在大门口扫入校码获取到进校通行码，向安保人员出示即可。</li>
            <li>参访人员入校仅限行人和自行车，<strong>机动车入校需要扫描停车计时收费二维码</strong>。</li>
          </ol>
        </div>
        <span slot="footer" class="dialog-footer">
          <el-button type="primary" @click="appointmentVisible = false">知 晓</el-button>
        </span>
      </el-dialog>

      <el-dialog title="关于本站" :visible.sync="collegeInfoVisible" width="500px" center>
        <div style="text-align: center; font-size: 16px; line-height: 2;">
          <p>本webgis网站是由中国农业大学东校区的<br><strong>很厉害的</strong>同学开发，感谢您的使用！</p>
          <div class="link-box" style="margin-top: 20px;">
            <a href="https://www.cau.edu.cn/" target="_blank" class="jump-link"><i class="el-icon-s-promotion"></i> 中国农业大学官网请点击</a>
          </div>
        </div>
        <span slot="footer" class="dialog-footer"><el-button type="primary" @click="collegeInfoVisible = false">确 定</el-button></span>
      </el-dialog>

      <el-dialog title="📝 提供建议" :visible.sync="suggestionVisible" width="500px">
        <el-form :model="suggestionForm" label-width="80px">
          <el-form-item label="您的称呼">
            <el-input v-model="suggestionForm.visitorName" placeholder="默认为“游客”"></el-input>
          </el-form-item>
          <el-form-item label="建议内容" required>
            <el-input type="textarea" :rows="5" placeholder="请填写您对本系统的改进建议..." v-model="suggestionForm.content"></el-input>
          </el-form-item>
        </el-form>
        <span slot="footer" class="dialog-footer">
          <el-button @click="suggestionVisible = false">取 消</el-button>
          <el-button type="primary" @click="submitSuggestion">提 交</el-button>
        </span>
      </el-dialog>

      <el-dialog title="🔐 管理员登录" :visible.sync="adminLoginVisible" width="400px" center>
        <el-input placeholder="请输入管理员密码" v-model="adminPassword" show-password @keyup.enter.native="handleAdminLogin">
          <template slot="prepend"><i class="el-icon-key"></i></template>
        </el-input>
        <div style="margin-top: 20px; text-align: center;">
          <el-button type="primary" @click="handleAdminLogin" style="width: 100%;">登 录</el-button>
        </div>
      </el-dialog>

      <el-dialog title="🛠️ 管理员控制台" :visible.sync="adminPanelVisible" width="900px">
        <el-tabs v-model="activeAdminTab">
          <el-tab-pane label="用户建议管理" name="suggestion">
            <el-table :data="suggestionList" border style="width: 100%" height="400">
              <el-table-column prop="visitorName" label="访客名称" width="120"></el-table-column>
              <el-table-column prop="content" label="建议内容"></el-table-column>
              <el-table-column prop="createTime" label="提交时间" width="180"></el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="失物招领管理" name="lostfound">
            <el-table :data="adminLostFoundList" border style="width: 100%" height="400">
              <el-table-column prop="properties.itemName" label="物品名称" width="150"></el-table-column>
              <el-table-column prop="properties.contact" label="联系方式" width="150"></el-table-column>
              <el-table-column label="类型" width="100">
                <template slot-scope="scope">
                  <el-tag :type="scope.row.properties.lostType === 'lost' ? 'danger' : 'success'">
                    {{ scope.row.properties.lostType === 'lost' ? '丢失' : '招领' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="properties.createTime" label="发布时间" width="180"></el-table-column>
              <el-table-column label="操作">
                <template slot-scope="scope">
                  <el-button size="mini" type="danger" icon="el-icon-delete" @click="deleteLostItem(scope.row.properties.id)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
        <span slot="footer" class="dialog-footer">
          <el-button type="danger" plain @click="logoutAdmin">退出登录</el-button>
          <el-button type="primary" @click="adminPanelVisible = false">关 闭</el-button>
        </span>
      </el-dialog>

      <el-dialog title="📢 发布失物招领" :visible.sync="lostFoundVisible" width="500px">
        <el-form :model="lostFoundForm" label-width="80px">
          <el-form-item label="类型" required>
            <el-radio-group v-model="lostFoundForm.lostType">
              <el-radio label="lost" border>😓 我丢东西了</el-radio>
              <el-radio label="found" border>😃 我捡到了</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="物品名称" required>
            <el-input v-model="lostFoundForm.itemName" placeholder="例如：黑色保温杯"></el-input>
          </el-form-item>
          <el-form-item label="描述" required>
            <el-input type="textarea" v-model="lostFoundForm.description" placeholder="例如：在北操场看台捡到，有蓝色贴纸..."></el-input>
          </el-form-item>
          <el-form-item label="联系方式" required>
            <el-input v-model="lostFoundForm.contact" placeholder="QQ / 微信 / 电话"></el-input>
          </el-form-item>
          <el-form-item label="您的称呼">
            <el-input v-model="lostFoundForm.visitorName" placeholder="默认为“游客”"></el-input>
          </el-form-item>
        </el-form>
        <span slot="footer" class="dialog-footer">
          <el-button @click="lostFoundVisible = false">取 消</el-button>
          <el-button type="primary" @click="submitLostFound">发 布</el-button>
        </span>
      </el-dialog>

    </el-container>
  </el-container>
</template>

<script>
import CampusMap from './components/CampusMap.vue';
import announcementData from './data/announcements.js';
import axios from 'axios';

export default {
  name: 'App',
  components: {
    CampusMap
  },
  data() {
    return {

      // 🔥 新增：顶部菜单的颜色控制变量
      topMenuTextColor: '#fff',       // 默认白色
      topMenuActiveTextColor: '#ffd04b', // 默认黄色


      // 🔥 新增：主题状态变量
      currentTheme: 'default',
      menuBgColor: '#f5f7fa',
      menuTextColor: '#333',
      menuActiveTextColor: '#409EFF',

      drawerVisible: false,
      drawerTitle: '',
      currentDrawer: '',

      appointmentVisible: false,
      collegeInfoVisible: false,

      announcementList: announcementData,

      layers: {
        canteen: false,
        scenery: false,
        toilet: false,
        building: true
      },

      busLines: {
        line1: false,
        line2: false,
        houde: false
      },

      // 建议相关
      suggestionVisible: false,
      suggestionForm: {
        visitorName: '',
        content: ''
      },

      // 管理员相关
      adminLoginVisible: false,
      adminPanelVisible: false,
      activeAdminTab: 'suggestion',
      adminPassword: '',
      isAdminLoggedIn: false,
      suggestionList: [],
      adminLostFoundList: [],

      // 失物招领相关
      lostFoundVisible: false,
      lostFoundForm: {
        itemName: '',
        description: '',
        contact: '',
        lostType: 'lost',
        visitorName: '',
        longitude: null,
        latitude: null
      },

      weatherText: ''
    };
  },
  mounted() {
    this.fetchWeather();
  },
  methods: {
    // 1. 获取天气
    fetchWeather() {
      axios.get('https://wttr.in/Beijing?format=j1&lang=zh-cn').then(res => {
        if (res.status === 200) {
          const data = res.data;
          let desc = data.current_condition[0].lang_zh ? data.current_condition[0].lang_zh[0].value : data.current_condition[0].weatherDesc[0].value;
          this.weatherText = `北京市: ${desc}, 温度: ${data.current_condition[0].temp_C}°C`;
        }
      }).catch(err => { console.error(err); this.weatherText = "北京: 天气数据加载中..."; });
    },

    // 2. 顶部菜单处理
    handleTopMenu(key) {
      if (key === '1') this.appointmentVisible = true;
      else if (key === '6') this.openDrawer('校园公告', 'notice');
      else if (key === '7') this.openDrawer('公交/校车查询', 'bus');
      else if (key === '10') { this.suggestionForm = { visitorName: '', content: '' }; this.suggestionVisible = true; }
      else if (key === '9') this.collegeInfoVisible = true;
      else if (key === '8') { if (this.isAdminLoggedIn) this.openAdminPanel(); else { this.adminPassword = ''; this.adminLoginVisible = true; } }
      else if (key === '11') { if (this.$refs.campusMap) this.$refs.campusMap.activateTool('pick-location'); }
    },

    // 3. 🔥 主题切换逻辑 (新功能)

    switchTheme(theme) {
      this.currentTheme = theme;

      if (theme === 'default') {
        // 1. 恢复侧边栏 (默认)
        this.menuBgColor = '#f5f7fa';
        this.menuTextColor = '#333';
        this.menuActiveTextColor = '#409EFF';

        // 2. 恢复顶部 (默认白字黄高亮)
        this.topMenuTextColor = '#fff';
        this.topMenuActiveTextColor = '#ffd04b';

        this.changeBaseMap('day');
        this.$message.success("已切换至：农大绿 (默认)");
      }
      else if (theme === 'theme-blue') {
        // 1. 设置侧边栏 (科技蓝)
        this.menuBgColor = '#021132';
        this.menuTextColor = '#00e1ff';
        this.menuActiveTextColor = '#fff';

        // 2. 🔥 设置顶部 (荧光蓝字 + 白色高亮) 🔥
        this.topMenuTextColor = '#00e1ff';
        this.topMenuActiveTextColor = '#fff';

        this.changeBaseMap('night');
        this.$message.success("已切换至：科技蓝 (大屏模式)");
      }
      else if (theme === 'theme-dark') {
        // 1. 设置侧边栏 (暗黑)
        this.menuBgColor = '#2b2b2b';
        this.menuTextColor = '#ccc';
        this.menuActiveTextColor = '#ffd04b';

        // 2. 设置顶部 (暗黑模式下顶部一般还是浅色字)
        this.topMenuTextColor = '#ccc';
        this.topMenuActiveTextColor = '#ffd04b';

        this.changeBaseMap('night');
        this.$message.success("已切换至：暗黑模式");
      }
    },

    // 4. 失物招领逻辑
    onLocationPicked(coords) { this.lostFoundForm = { itemName: '', description: '', contact: '', lostType: 'lost', visitorName: '', longitude: coords.lng, latitude: coords.lat }; this.lostFoundVisible = true; },
    submitLostFound() { if (!this.lostFoundForm.itemName || !this.lostFoundForm.contact) { this.$message.warning("请填写物品名称和联系方式"); return; } this.$axios.post('/lost/add', this.lostFoundForm).then(() => { this.$message.success("发布成功！"); this.lostFoundVisible = false; if (this.$refs.campusMap) this.$refs.campusMap.loadLostFoundData(); }).catch(err => { console.error(err); this.$message.error("发布失败"); }); },
    deleteLostItem(id) { this.$confirm('确定要删除这条失物招领信息吗？', '提示', { type: 'warning' }).then(() => { this.$axios.post(`/lost/delete?id=${id}`).then(() => { this.$message.success("删除成功"); this.openAdminPanel(); if (this.$refs.campusMap) this.$refs.campusMap.loadLostFoundData(); }); }); },

    // 5. 建议与管理员逻辑
    submitSuggestion() { if (!this.suggestionForm.content) { this.$message.warning("请填写建议内容"); return; } const payload = { visitorName: this.suggestionForm.visitorName || '游客', content: this.suggestionForm.content }; this.$axios.post('/suggestion/add', payload).then(() => { this.$message.success("提交成功！"); this.suggestionVisible = false; }).catch(err => { console.error(err); this.$message.error("提交失败"); }); },
    handleAdminLogin() { if (this.adminPassword === '123456') { this.$message.success("管理员登录成功"); this.isAdminLoggedIn = true; this.adminLoginVisible = false; this.openAdminPanel(); } else { this.$message.error("密码错误"); } },
    openAdminPanel() { this.$axios.get('/suggestion/list').then(res => { this.suggestionList = res.data; }); this.$axios.get('/lost/list').then(res => { this.adminLostFoundList = res.data.features || []; }); this.adminPanelVisible = true; },
    logoutAdmin() { this.isAdminLoggedIn = false; this.adminPanelVisible = false; this.$message.info("已退出管理员模式"); },

    // 6. 地图交互逻辑
    openDrawer(title, type) { this.drawerTitle = title; this.currentDrawer = type; this.drawerVisible = true; },
    toggleLayer(layerName) { if (this.$refs.campusMap) this.$refs.campusMap.updateLayer(layerName, this.layers[layerName]); },
    changeBaseMap(type) { if (this.$refs.campusMap) this.$refs.campusMap.switchBaseMap(type); },
    toggleBus() { const targets = []; if (this.busLines.line1) targets.push("一号"); if (this.busLines.line2) targets.push("二号"); if (this.busLines.houde) targets.push("厚德"); if (this.$refs.campusMap) this.$refs.campusMap.updateBusLayer(targets); },
    resetMap() { if (this.$refs.campusMap) this.$refs.campusMap.resetMap(); else this.$message.info('地图已复位'); },

    // 7. 工具激活 (含时光机)
    activateTool(toolName) {
      if (toolName === 'timemachine') {
        if (this.$refs.campusMap) this.$refs.campusMap.activateTimeMachine();
      } else {
        this.$message.info(`激活工具: ${toolName}`);
        if (this.$refs.campusMap) this.$refs.campusMap.activateTool(toolName);
      }
    }
  },

    handleTopMenu(key) {
      if (key === '1') {
        this.appointmentVisible = true;
      } else if (key === '6') {
        this.openDrawer('校园公告', 'notice');
      } else if (key === '7') {
        this.openDrawer('公交/校车查询', 'bus');
      } else if (key === '10') {
        this.suggestionForm = { visitorName: '', content: '' };
        this.suggestionVisible = true;
      } else if (key === '9') {
        this.collegeInfoVisible = true;
      } else if (key === '8') {
        if (this.isAdminLoggedIn) {
          this.openAdminPanel();
        } else {
          this.adminPassword = '';
          this.adminLoginVisible = true;
        }
      } else if (key === '11') {
        // 开启失物招领发布模式
        if (this.$refs.campusMap) {
          this.$refs.campusMap.activateTool('pick-location');
        }
      }
    },

    onLocationPicked(coords) {
      this.lostFoundForm = {
        itemName: '',
        description: '',
        contact: '',
        lostType: 'lost',
        visitorName: '',
        longitude: coords.lng,
        latitude: coords.lat
      };
      this.lostFoundVisible = true;
    },

    submitLostFound() {
      if (!this.lostFoundForm.itemName || !this.lostFoundForm.contact) {
        this.$message.warning("请填写物品名称和联系方式");
        return;
      }
      this.$axios.post('/lost/add', this.lostFoundForm)
          .then(() => {
            this.$message.success("发布成功！");
            this.lostFoundVisible = false;
            if (this.$refs.campusMap) {
              this.$refs.campusMap.loadLostFoundData();
            }
          })
          .catch(err => {
            console.error(err);
            this.$message.error("发布失败，请重试");
          });
    },

    submitSuggestion() {
      if (!this.suggestionForm.content) {
        this.$message.warning("请填写建议内容");
        return;
      }
      const payload = {
        visitorName: this.suggestionForm.visitorName || '游客',
        content: this.suggestionForm.content
      };
      this.$axios.post('/suggestion/add', payload)
          .then(() => {
            this.$message.success("提交成功，感谢您的宝贵建议！");
            this.suggestionVisible = false;
          })
          .catch(err => {
            console.error(err);
            this.$message.error("提交失败，请稍后重试");
          });
    },

    handleAdminLogin() {
      if (this.adminPassword === '123456') {
        this.$message.success("管理员登录成功");
        this.isAdminLoggedIn = true;
        this.adminLoginVisible = false;
        this.openAdminPanel();
      } else {
        this.$message.error("密码错误");
      }
    },

    openAdminPanel() {
      // 获取建议列表
      this.$axios.get('/suggestion/list').then(res => {
        this.suggestionList = res.data;
      });
      // 获取失物列表
      this.$axios.get('/lost/list').then(res => {
        this.adminLostFoundList = res.data.features || [];
      });
      this.adminPanelVisible = true;
    },

    deleteLostItem(id) {
      this.$confirm('确定要删除这条失物招领信息吗？这将同时移除地图上的标记点。', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        this.$axios.post(`/lost/delete?id=${id}`)
            .then(() => {
              this.$message.success("删除成功");
              this.openAdminPanel(); // 刷新列表
              if (this.$refs.campusMap) this.$refs.campusMap.loadLostFoundData(); // 刷新地图
            })
            .catch(err => {
              console.error(err);
              this.$message.error("删除失败");
            });
      }).catch(() => {});
    },

    logoutAdmin() {
      this.isAdminLoggedIn = false;
      this.adminPanelVisible = false;
      this.$message.info("已退出管理员模式");
    },

    openDrawer(title, type) {
      this.drawerTitle = title;
      this.currentDrawer = type;
      this.drawerVisible = true;
    },
    toggleLayer(layerName) {
      const isChecked = this.layers[layerName];
      if (this.$refs.campusMap) {
        this.$refs.campusMap.updateLayer(layerName, isChecked);
      }
    },
    changeBaseMap(type) {
      if (this.$refs.campusMap) {
        this.$refs.campusMap.switchBaseMap(type);
      }
    },

    // 🔥 工具与时光机激活逻辑
    activateTool(toolName) {
      if (toolName === 'timemachine') {
        if (this.$refs.campusMap) this.$refs.campusMap.activateTimeMachine();
      } else {
        this.$message.info(`激活工具: ${toolName}`);
        if (this.$refs.campusMap) {
          this.$refs.campusMap.activateTool(toolName);
        }
      }
    },

    resetMap() {
      if (this.$refs.campusMap) {
        this.$refs.campusMap.resetMap();
      } else {
        this.$message.info('地图已复位');
      }
    },
    toggleBus() {
      const targets = [];
      if (this.busLines.line1) targets.push("一号");
      if (this.busLines.line2) targets.push("二号");
      if (this.busLines.houde) targets.push("厚德");
      if (this.$refs.campusMap) {
        this.$refs.campusMap.updateBusLayer(targets);
      }
    }
};
</script>

<style>

/* --- 👇 将这些代码追加到 <style> 的最后面 👇 --- */

/* 弹窗文字与链接样式 */
.appointment-content { line-height: 1.6; font-size: 14px; color: #333; }
.link-box { background-color: #f0f9eb; padding: 10px; border-radius: 4px; text-align: center; margin-bottom: 15px; border: 1px solid #e1f3d8; }
.jump-link { color: #409EFF; font-weight: bold; text-decoration: none; font-size: 16px; }
.jump-link:hover { text-decoration: underline; color: #66b1ff; }
.intro-text { text-indent: 2em; margin-bottom: 15px; }
.step-list { padding-left: 20px; }
.step-list li { margin-bottom: 10px; text-align: justify; }

/* 公告栏样式 */
.link-box-small { text-align: right; margin-bottom: 10px; font-size: 13px; }
.jump-link-small { color: #409EFF; text-decoration: none; }
.jump-link-small:hover { text-decoration: underline; }
.notice-title-row { display: flex; justify-content: space-between; width: 100%; padding-right: 10px; }
.notice-title { font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; }
.notice-date { font-size: 12px; color: #999; }
.notice-body { padding: 0 5px; }
.notice-meta { font-size: 12px; color: #888; margin-bottom: 8px; border-bottom: 1px dashed #eee; padding-bottom: 5px; }
.notice-text { font-size: 13px; line-height: 1.6; white-space: pre-wrap; color: #333; }

/* 公交卡片样式 */
.bus-card { margin-bottom: 15px; }
.bus-card .text { font-size: 13px; line-height: 1.6; }
.bus-card p { margin: 5px 0; }


/* 全局样式 */
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", Arial, sans-serif;
}
.app-wrapper {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* 顶部导航栏 */
.cau-header {
  background-color: #2d5a27;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  z-index: 1000;
}
.logo-area {
  display: flex;
  align-items: center;
  color: white;
  font-size: 20px;
  font-weight: bold;
}
.logo {
  height: 40px;
  margin-right: 15px;
}
.header-right {
  display: flex;
  align-items: center;
}
.weather-info {
  color: white;
  margin-right: 20px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
}
.weather-info i {
  margin-right: 5px;
  font-size: 18px;
}
.weather-info:hover {
  color: #ffd04b;
}
.top-menu.el-menu {
  border-bottom: none;
}

/* 主体区域 */
.main-body {
  flex: 1;
  overflow: hidden;
}

/* 左侧面板 */
.left-panel {
  background-color: #f5f7fa;
  border-right: 1px solid #e6e6e6;
  box-shadow: 2px 0 5px rgba(0,0,0,0.05);
  z-index: 900;
}
.left-menu {
  border-right: none;
}
.layer-check {
  display: block;
  margin-left: 20px !important;
  margin-bottom: 10px;
}

/* 地图容器 */
.map-wrapper {
  padding: 0;
  position: relative;
}

/* 抽屉内容 */
.drawer-content {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
}

/* 悬浮按钮 */
.reset-btn {
  position: absolute;
  bottom: 30px;
  right: 30px;
  z-index: 800;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

/* 弹窗内容样式 */
.appointment-content {
  line-height: 1.6;
  font-size: 14px;
  color: #333;
}
.link-box {
  background-color: #f0f9eb;
  padding: 10px;
  border-radius: 4px;
  text-align: center;
  margin-bottom: 15px;
  border: 1px solid #e1f3d8;
}
.jump-link {
  color: #409EFF;
  font-weight: bold;
  text-decoration: none;
  font-size: 16px;
}
.jump-link:hover {
  text-decoration: underline;
  color: #66b1ff;
}
.intro-text {
  text-indent: 2em;
  margin-bottom: 15px;
}
.step-list {
  padding-left: 20px;
}
.step-list li {
  margin-bottom: 10px;
  text-align: justify;
}

/* 公告样式 */
.link-box-small {
  text-align: right;
  margin-bottom: 10px;
  font-size: 13px;
}
.jump-link-small {
  color: #409EFF;
  text-decoration: none;
}
.jump-link-small:hover {
  text-decoration: underline;
}
.notice-title-row {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding-right: 10px;
}
.notice-title {
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}
.notice-date {
  font-size: 12px;
  color: #999;
}
.notice-body {
  padding: 0 5px;
}
.notice-meta {
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
  border-bottom: 1px dashed #eee;
  padding-bottom: 5px;
}
.notice-text {
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  color: #333;
}

/* 公交卡片样式 */
.bus-card {
  margin-bottom: 15px;
}
.bus-card .text {
  font-size: 13px;
  line-height: 1.6;
}
.bus-card p {
  margin: 5px 0;
}


/* --- 🔥 风格切换样式 --- */

/* 1. 默认过渡动画 (让切换丝滑一点) */
.cau-header, .left-panel {
  transition: all 0.5s ease;
}

/* 2. 🌌 科技蓝主题 (theme-blue) */
/* 当顶层容器有 class="theme-blue" 时生效 */
.theme-blue .cau-header {
  background: linear-gradient(90deg, #0f1c3a 0%, #1e457a 100%) !important; /* 渐变蓝 */
  border-bottom: 2px solid #00e1ff; /* 荧光底边 */
  box-shadow: 0 2px 20px rgba(0, 225, 255, 0.2);
}
.theme-blue .system-title {
  color: #00e1ff !important;
  text-shadow: 0 0 10px rgba(0, 225, 255, 0.5); /* 文字发光效果 */
  font-family: 'Courier New', Courier, monospace; /* 科技字体 */
  letter-spacing: 2px;
}
.theme-blue .left-panel {
  background-color: #021132 !important; /* 深蓝侧边栏 */
  border-right: 1px solid #1e457a;
  box-shadow: 2px 0 15px rgba(0, 0, 0, 0.5);
}
/* 强行覆盖 ElementUI 的菜单悬停颜色 */
.theme-blue .el-submenu__title:hover,
.theme-blue .el-menu-item:hover,
.theme-blue .el-menu-item:focus {
  background-color: rgba(0, 225, 255, 0.15) !important;
}
.theme-blue .layer-check {
  color: #00e1ff !important; /* 复选框文字变蓝 */
}

/* 3. 🌑 暗黑模式 (theme-dark) */
.theme-dark .cau-header {
  background-color: #1f1f1f !important;
  border-bottom: 1px solid #333;
}
.theme-dark .system-title {
  color: #ffd04b; /* 黄色标题 */
}
.theme-dark .left-panel {
  background-color: #2b2b2b !important;
  border-right: 1px solid #333;
}
.theme-dark .layer-check {
  color: #ccc !important;
}


/* 🔥 强制顶部菜单的图标颜色跟随文字颜色 */
.top-menu .el-menu-item i {
  color: inherit !important;
}

/* 科技蓝主题下的顶部菜单悬停效果 */
.theme-blue .top-menu .el-menu-item:hover,
.theme-blue .top-menu .el-menu-item:focus {
  background-color: rgba(0, 225, 255, 0.1) !important; /* 淡淡的蓝光背景 */
  color: #fff !important;
}

/* 修复天气图标的颜色继承 */
.weather-info i {
  color: inherit !important;
}

</style>