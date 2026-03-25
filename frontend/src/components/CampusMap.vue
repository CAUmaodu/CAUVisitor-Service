<template>
  <div class="container">
    <div id="map-container"></div>

    <div class="search-box" v-if="!isTimeMachineActive">
      <div class="search-input-row">
        <el-input placeholder="请输入地点名称" v-model="searchKeyword" @keyup.enter.native="handleSearch" clearable>
          <el-button slot="append" icon="el-icon-search" @click="handleSearch"></el-button>
        </el-input>
      </div>
      <div class="quick-search-btns">
        <el-button size="mini" type="primary" plain @click="quickSearch('老水塔')">老水塔</el-button>
        <el-button size="mini" type="primary" plain @click="quickSearch('毛泽东雕像')">毛泽东雕像</el-button>
        <el-button size="mini" type="primary" plain @click="quickSearch('图书馆')">图书馆</el-button>
        <el-button size="mini" type="primary" plain @click="quickSearch('肯德基')">肯德基</el-button>
        <el-button size="mini" type="primary" plain @click="quickSearch('东南门')">东南门</el-button>
      </div>
    </div>

    <div v-if="currentTool === 'pick-location'" class="tip-box">
      <i class="el-icon-location-information"></i> 请在地图上点击 <b>丢失</b> 或 <b>捡到</b> 物品的位置
      <el-button type="text" @click="clearTools" style="margin-left: 10px; color: #f56c6c;">取消</el-button>
    </div>

    <div v-if="isTimeMachineActive" class="time-machine-panel">
      <div class="panel-header">
        <span class="title">📷 农大校园时光机 ({{ currentYear }})</span>
        <el-button type="danger" size="mini" circle icon="el-icon-close" @click="exitTimeMachine" title="退出时光机"></el-button>
      </div>
      <div class="slider-container">
        <span class="year-label left">2003</span>
        <el-slider
            v-model="sliderIndex"
            :min="0"
            :max="years.length - 1"
            :step="1"
            :format-tooltip="formatTooltip"
            @change="handleYearChange"
            style="flex: 1; margin: 0 15px;">
        </el-slider>
        <span class="year-label right">2025</span>
      </div>
      <div class="panel-tip">
        <i class="el-icon-info"></i> 拖动中间的垂直分割线对比，下方滑块切换年份
      </div>
    </div>
  </div>
</template>

<script>
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-side-by-side'; // 引入卷帘插件

// 修复 Leaflet 默认图标丢失问题
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

export default {
  name: 'CampusMap',
  data() {
    return {
      map: null,
      searchKeyword: '',
      searchLayer: null,

      allPointsData: null,
      lostFoundData: null,

      layerGroups: {
        laoshuita: new L.LayerGroup(),
        maozhuxi: new L.LayerGroup(),
        tushuguan: new L.LayerGroup(),
        kendeji: new L.LayerGroup(),
        dongnanmen: new L.LayerGroup()
      },
      lostFoundLayerGroup: new L.LayerGroup(),

      currentTool: null,
      measurePoints: [],
      measurePolyline: null,
      routeStart: null,
      routeEnd: null,
      routeLayer: null,

      currentBaseLayer: null,

      // 🔥 时光机相关数据
      isTimeMachineActive: false,
      years: [2003, 2005, 2010, 2014, 2017, 2021, 2025], // 这里的年份必须和你文件夹名一致
      sliderIndex: 0,
      currentYear: 2003,
      historyLayer: null,
      nowLayer: null,
      sideBySideControl: null
    };
  },
    mounted() {
      this.initMap();
      this.loadData();
      this.loadLostFoundData();
      setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 200);
    },
  methods: {
    initMap() {
      this.map = L.map('map-container', { attributionControl: false }).setView([40.004, 116.358], 17);
      L.control.zoom({ position: 'bottomright' }).addTo(this.map);
      this.switchBaseMap('day'); // 默认日间模式

      this.map.on('click', this.handleMapClick);
      this.map.on('dblclick', this.finishMeasure);

      this.lostFoundLayerGroup.addTo(this.map);
    },

    // --- 数据加载 ---
    loadData() {
      this.$axios.get('/pointmodel/all').then(res => {
        this.allPointsData = this.convertGeoJSONToGCJ02(res.data);
      }).catch(e => console.error(e));
    },
    loadLostFoundData() {
      this.$axios.get('/lost/list').then(res => {
        this.lostFoundData = this.convertGeoJSONToGCJ02(res.data);
        this.renderLostFound();
      }).catch(e => console.error("加载失物招领失败", e));
    },

    // --- 渲染逻辑 ---
    renderLostFound() {
      this.lostFoundLayerGroup.clearLayers();
      if (!this.lostFoundData) return;
      L.geoJSON(this.lostFoundData, {
        onEachFeature: (feature, layer) => {
          const p = feature.properties;
          const titleColor = p.lostType === 'lost' ? '#F56C6C' : '#67C23A';
          const typeText = p.lostType === 'lost' ? '寻物启事' : '失物招领';
          const content = `<div style="width: 200px;"><h4 style="margin:0 0 5px 0; color:${titleColor}; border-bottom:1px solid #eee; padding-bottom:5px;">${typeText}: ${p.itemName}</h4><p style="margin:5px 0; color:#666; font-size:13px;">${p.description}</p><p style="margin:5px 0; font-size:12px;"><b>联系人:</b> ${p.visitorName}</p><p style="margin:5px 0; font-size:12px;"><b>联系方式:</b> ${p.contact}</p><p style="margin:5px 0; color:#999; font-size:12px;">${p.createTime}</p></div>`;
          layer.bindPopup(content);
        }
      }).addTo(this.lostFoundLayerGroup);
    },

    // --- 工具控制 ---
    activateTool(toolType) {
      this.clearTools();
      this.currentTool = toolType;

      if (toolType === 'measure') this.$message.info('【距离测量】请单击选点，双击结束');
      else if (toolType === 'route') this.$message.info('【路径规划】请点击起点，再点击终点');
      else if (toolType === 'pick-location') this.$message.success('请在地图上点击 丢失/捡到 的位置');

      L.DomUtil.addClass(this.map._container, 'crosshair-cursor-enabled');
    },

    handleMapClick(e) {
      if (!this.currentTool) return;
      const latlng = e.latlng;

      // 拾取坐标模式
      if (this.currentTool === 'pick-location') {
        const wgs84 = this.gcj02towgs84(latlng.lng, latlng.lat);
        this.$emit('location-picked', { lat: wgs84[1], lng: wgs84[0] });
        this.clearTools();
        return;
      }

      // 测量模式
      if (this.currentTool === 'measure') {
        this.measurePoints.push(latlng);
        L.circleMarker(latlng, {radius: 4, color: 'red', fillColor: '#f03', fillOpacity: 1}).addTo(this.map);
        if (this.measurePolyline) this.measurePolyline.setLatLngs(this.measurePoints);
        else this.measurePolyline = L.polyline(this.measurePoints, {color: 'red'}).addTo(this.map);
      }
      // 路径规划模式
      else if (this.currentTool === 'route') {
        if (!this.routeStart) {
          this.routeStart = L.marker(latlng).addTo(this.map).bindPopup("起点").openPopup();
          this.$message.success("起点已定，请选择终点");
        } else if (!this.routeEnd) {
          this.routeEnd = L.marker(latlng).addTo(this.map).bindPopup("终点").openPopup();
          this.calculateRealRoute();
          this.currentTool = null;
          L.DomUtil.removeClass(this.map._container, 'crosshair-cursor-enabled');
        }
      }
    },

    // --- 🔥 时光机逻辑 ---
// --- 🔥 时光机逻辑 (修复版 V2) ---
// --- 🔥 修复版：激活时光机 ---
// --- 🔥 时光机逻辑 (最终修复版) ---
    activateTimeMachine() {
      this.isTimeMachineActive = true;
      this.currentYear = this.years[0];
      this.sliderIndex = 0;
      this.$message.success("欢迎进入时光机！");

      // 清理现有图层
      if (this.currentBaseLayer) this.map.removeLayer(this.currentBaseLayer);
      this.map.removeLayer(this.lostFoundLayerGroup);
      Object.values(this.layerGroups).forEach(g => this.map.removeLayer(g));

      // 1. 左侧：历史图层 (保持不变，指向本地后端)
      this.historyLayer = L.tileLayer(`http://localhost:8081/cauvisitor/history_tiles/${this.currentYear}/{z}/{x}/{y}.png`, {
        minZoom: 12, maxZoom: 18, tms: false
      }).addTo(this.map);

      // 2. 右侧：现在的卫星图 (🔥 修改点：换成 ArcGIS 影像)
      // ArcGIS World Imagery 服务，全球通用，速度较快，且为卫星实景
      this.nowLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri', // 尊重版权
        minZoom: 12,
        maxZoom: 18
      }).addTo(this.map);

      // 初始化卷帘
      this.sideBySideControl = L.control.sideBySide(this.historyLayer, this.nowLayer);
      this.sideBySideControl.addTo(this.map);
    },

    // --- 🔥 修复版：切换年份 ---
    handleYearChange(val) {
      this.currentYear = this.years[val];
      this.$message.info(`切换至 ${this.currentYear} 年`);

      if (this.historyLayer) this.map.removeLayer(this.historyLayer);

      // 🔥 核心修复：同样加上 http://localhost:8081
      this.historyLayer = L.tileLayer(`http://localhost:8081/cauvisitor/history_tiles/${this.currentYear}/{z}/{x}/{y}.png`, {
        minZoom: 12, maxZoom: 18, tms: false
      }).addTo(this.map);

      this.sideBySideControl.setLeftLayers(this.historyLayer);
    },

    exitTimeMachine() {
      this.isTimeMachineActive = false;

      if (this.sideBySideControl) {
        this.map.removeControl(this.sideBySideControl);
        this.sideBySideControl = null;
      }
      if (this.historyLayer) this.map.removeLayer(this.historyLayer);
      if (this.nowLayer) this.map.removeLayer(this.nowLayer);

      this.switchBaseMap('day');
      this.lostFoundLayerGroup.addTo(this.map);

      this.$message.success("已退出时光机模式");
    },

    formatTooltip(val) { return this.years[val] + '年'; },

    // --- 基础地图控制 ---
    switchBaseMap(type) {
      if (!this.map) return;
      if (this.currentBaseLayer) this.map.removeLayer(this.currentBaseLayer);
      let newLayer = null;
      if (type === 'day') {
        newLayer = L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', { subdomains: ["1", "2", "3", "4"], minZoom: 1, maxZoom: 18 });
        this.$message.success("已切换至：标准地图");
      } else if (type === 'night') {
        newLayer = L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', { subdomains: ["1", "2", "3", "4"], minZoom: 1, maxZoom: 18, className: 'night-tiles' });
        this.$message.success("已切换至：夜间模式");
      } else if (type === 'satellite') {
        newLayer = L.tileLayer('https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}', { subdomains: ["1", "2", "3", "4"], minZoom: 1, maxZoom: 18 });
        this.$message.success("已切换至：卫星影像");
      } else if (type === 'hybrid') {
        const satLayer = L.tileLayer('https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}', { subdomains: ["1", "2", "3", "4"] });
        const labelLayer = L.tileLayer('https://webst0{s}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}', { subdomains: ["1", "2", "3", "4"] });
        newLayer = L.layerGroup([satLayer, labelLayer]);
        this.$message.success("已切换至：混合路网");
      }
      if (newLayer) {
        newLayer.addTo(this.map);
        if (typeof newLayer.bringToBack === 'function') newLayer.bringToBack();
        this.currentBaseLayer = newLayer;
      }
    },
    updateLayer(type, isVisible) {
      if (!this.allPointsData) return;
      const group = this.layerGroups[type];
      if (!isVisible) { if (this.map.hasLayer(group)) this.map.removeLayer(group); return; }
      group.clearLayers();
      L.geoJSON(this.allPointsData, {
        filter: (feature) => {
          const name = feature.properties.name || "";
          if (type === 'laoshuita') return name.includes('老水塔');
          if (type === 'maozhuxi') return name.includes('毛泽东雕像');
          if (type === 'tushuguan') return name.includes('图书馆');
          if (type === 'kendeji') return name.includes('肯德基');
          if (type === 'dongnanmen') return name.includes('东南门');
          return false;
        },
        onEachFeature: (feature, layer) => { layer.bindPopup(`<strong>${feature.properties.name}</strong>`); }
      }).eachLayer((layer) => group.addLayer(layer));
      this.map.addLayer(group);
    },
    calculateRealRoute() {
      const p1_gcj = this.routeStart.getLatLng();
      const p2_gcj = this.routeEnd.getLatLng();
      const loading = this.$loading({ lock: true, text: '正在规划路线...', spinner: 'el-icon-loading', background: 'rgba(0, 0, 0, 0.7)' });
      
      const amapKey = 'YOUR_AMAP_API_KEY';
      const url = `https://restapi.amap.com/v3/direction/walking?origin=${p1_gcj.lng},${p1_gcj.lat}&destination=${p2_gcj.lng},${p2_gcj.lat}&key=${amapKey}`;
      
      fetch(url).then(res => res.json()).then(data => {
        loading.close();
        if (data.status !== '1' || !data.paths || data.paths.length === 0) {
          this.$message.warning("无法规划路径，请检查API Key是否正确");
          return;
        }
        const path = data.paths[0];
        const steps = path.steps;
        let allPoints = [];
        steps.forEach(step => {
          const polyline = step.polyline;
          const points = polyline.split(';').map(p => {
            const [lng, lat] = p.split(',').map(Number);
            return [lng, lat];
          });
          allPoints = allPoints.concat(points);
        });
        if (this.routeLayer) this.map.removeLayer(this.routeLayer);
        this.routeLayer = L.polyline(allPoints, { color: 'blue', weight: 6, opacity: 0.8 }).addTo(this.map);
        this.map.fitBounds(this.routeLayer.getBounds(), {padding: [50, 50]});
        this.$message.success(`路径规划成功！全长约${path.distance}米，预计步行${path.duration}秒`);
      }).catch(err => {
        loading.close();
        console.error(err);
        this.$message.error("路径规划服务异常，请检查网络连接");
      });
    },
    finishMeasure() {
      if (this.currentTool !== 'measure') return;
      if (this.measurePoints.length < 2) return;
      let totalDistance = 0;
      for (let i = 0; i < this.measurePoints.length - 1; i++) totalDistance += this.map.distance(this.measurePoints[i], this.measurePoints[i + 1]);
      L.popup().setLatLng(this.measurePoints[this.measurePoints.length - 1]).setContent(`<b>总距离：${totalDistance.toFixed(2)} 米</b>`).openOn(this.map);
      this.currentTool = null;
      L.DomUtil.removeClass(this.map._container, 'crosshair-cursor-enabled');
    },
    clearTools() {
      this.measurePoints = [];
      if (this.measurePolyline) this.map.removeLayer(this.measurePolyline);
      this.measurePolyline = null;
      if (this.routeStart) this.map.removeLayer(this.routeStart);
      if (this.routeEnd) this.map.removeLayer(this.routeEnd);
      if (this.routeLayer) this.map.removeLayer(this.routeLayer);
      this.routeStart = null; this.routeEnd = null; this.routeLayer = null;
      this.currentTool = null;
      L.DomUtil.removeClass(this.map._container, 'crosshair-cursor-enabled');
      this.map.closePopup();
    },
    quickSearch(keyword) {
      this.searchKeyword = keyword;
      this.handleSearch();
    },
    handleSearch() {
      if (!this.searchKeyword) { this.$message.warning("请输入关键词"); return; }
      this.$axios.get('/polygonmodel/search', { params: {name: this.searchKeyword} }).then(res => {
        const data = res.data;
        if (!data.features || data.features.length === 0) { this.$message.info("未找到相关地点"); return; }
        this.$message.success(`找到 ${data.features.length} 个结果`);
        if (this.searchLayer) this.map.removeLayer(this.searchLayer);
        const convertedData = this.convertGeoJSONToGCJ02(data);
        this.searchLayer = L.geoJSON(convertedData, {
          style: {color: 'red', fillColor: '#ff0000', fillOpacity: 0.6, weight: 3},
          onEachFeature: (feature, layer) => {
            if (feature.properties && feature.properties.name) layer.bindPopup(`<strong>${feature.properties.name}</strong>`).openPopup();
          }
        }).addTo(this.map);
        this.map.fitBounds(this.searchLayer.getBounds(), {padding: [50, 50]});
      }).catch(err => { console.error(err); this.$message.error("搜索出错"); });
    },
    resetMap() { if (this.map) { this.map.setView([34.817, 113.538], 16); this.$message.success("地图视角已复位"); } },

    // --- 坐标转换 (WGS84 <-> GCJ02) ---
    convertGeoJSONToGCJ02(geojson) {
      if (!geojson) return null;
      const data = JSON.parse(JSON.stringify(geojson));
      const processGeometry = (geometry) => {
        if (!geometry || !geometry.coordinates) return;
        if (geometry.type === 'Point') geometry.coordinates = this.wgs84togcj02(geometry.coordinates[0], geometry.coordinates[1]);
        else if (geometry.type === 'LineString' || geometry.type === 'MultiPoint') geometry.coordinates = geometry.coordinates.map(c => this.wgs84togcj02(c[0], c[1]));
        else if (geometry.type === 'Polygon' || geometry.type === 'MultiLineString') geometry.coordinates = geometry.coordinates.map(ring => ring.map(c => this.wgs84togcj02(c[0], c[1])));
        else if (geometry.type === 'MultiPolygon') geometry.coordinates = geometry.coordinates.map(poly => poly.map(ring => ring.map(c => this.wgs84togcj02(c[0], c[1]))));
      };
      if (data.type === 'FeatureCollection') data.features.forEach(f => processGeometry(f.geometry));
      else if (data.type === 'Feature') processGeometry(data.geometry);
      else processGeometry(data);
      return data;
    },
    wgs84togcj02(lng, lat) {
      if (this.out_of_china(lng, lat)) return [lng, lat];
      var dlat = this.transformlat(lng - 105.0, lat - 35.0), dlng = this.transformlng(lng - 105.0, lat - 35.0);
      var radlat = lat / 180.0 * Math.PI, magic = Math.sin(radlat);
      magic = 1 - 0.00669342162296594323 * magic * magic;
      var sqrtmagic = Math.sqrt(magic);
      dlat = (dlat * 180.0) / ((6378245.0 * (1 - 0.00669342162296594323)) / (magic * sqrtmagic) * Math.PI);
      dlng = (dlng * 180.0) / (6378245.0 / sqrtmagic * Math.cos(radlat) * Math.PI);
      return [lng + dlng, lat + dlat];
    },
    gcj02towgs84(lng, lat) {
      if (this.out_of_china(lng, lat)) return [lng, lat];
      var dlat = this.transformlat(lng - 105.0, lat - 35.0), dlng = this.transformlng(lng - 105.0, lat - 35.0);
      var radlat = lat / 180.0 * Math.PI, magic = Math.sin(radlat);
      magic = 1 - 0.00669342162296594323 * magic * magic;
      var sqrtmagic = Math.sqrt(magic);
      dlat = (dlat * 180.0) / ((6378245.0 * (1 - 0.00669342162296594323)) / (magic * sqrtmagic) * Math.PI);
      dlng = (dlng * 180.0) / (6378245.0 / sqrtmagic * Math.cos(radlat) * Math.PI);
      return [lng * 2 - (lng + dlng), lat * 2 - (lat + dlat)];
    },
    transformlat(lng, lat) {
      var ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
      ret += (20.0 * Math.sin(6.0 * lng * Math.PI) + 20.0 * Math.sin(2.0 * lng * Math.PI)) * 2.0 / 3.0;
      ret += (20.0 * Math.sin(lat * Math.PI) + 40.0 * Math.sin(lat / 3.0 * Math.PI)) * 2.0 / 3.0;
      ret += (160.0 * Math.sin(lat / 12.0 * Math.PI) + 320 * Math.sin(lat * Math.PI / 30.0)) * 2.0 / 3.0;
      return ret;
    },
    transformlng(lng, lat) {
      var ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
      ret += (20.0 * Math.sin(6.0 * lng * Math.PI) + 20.0 * Math.sin(2.0 * lng * Math.PI)) * 2.0 / 3.0;
      ret += (20.0 * Math.sin(lng * Math.PI) + 40.0 * Math.sin(lng / 3.0 * Math.PI)) * 2.0 / 3.0;
      ret += (150.0 * Math.sin(lng / 12.0 * Math.PI) + 300.0 * Math.sin(lng / 30.0 * Math.PI)) * 2.0 / 3.0;
      return ret;
    },
    out_of_china(lng, lat) { return (lng < 72.004 || lng > 137.8347) || ((lat < 0.8293 || lat > 55.8271)); }
  }
};
</script>

<style scoped>
.container >>> .crosshair-cursor-enabled { cursor: crosshair; }
.container { position: relative; width: 100%; height: 100vh; }
#map-container { width: 100%; height: 100%; z-index: 1; background-color: #ddd; }
.search-box { position: absolute; top: 20px; left: 50px; z-index: 2000; width: 340px; background: white; border-radius: 4px; box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1); padding: 10px; }
.search-input-row { margin-bottom: 8px; }
.quick-search-btns { display: flex; flex-wrap: wrap; gap: 5px; justify-content: center; }
.quick-search-btns .el-button { flex: 1; min-width: 60px; max-width: 90px; }
.tip-box { position: absolute; top: 80px; left: 50%; transform: translateX(-50%); z-index: 2000; background: rgba(255, 255, 255, 0.9); padding: 10px 20px; border-radius: 4px; box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1); font-size: 14px; color: #333; }
.container >>> .night-tiles {
  filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%) grayscale(20%);
  -webkit-filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%) grayscale(20%);
}

/* 🔥 时光机控制面板样式 */
.time-machine-panel {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  background: rgba(255, 255, 255, 0.95);
  padding: 15px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  z-index: 3000;
  display: flex;
  flex-direction: column;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.panel-header .title {
  font-weight: bold;
  font-size: 16px;
  color: #333;
}
.slider-container {
  display: flex;
  align-items: center;
}
.year-label {
  font-weight: bold;
  color: #666;
  font-size: 14px;
}
.panel-tip {
  margin-top: 10px;
  text-align: center;
  font-size: 12px;
  color: #999;
}
</style>