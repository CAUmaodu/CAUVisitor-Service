<template>
  <div class="container">
    <div id="map-container"></div>

    <div class="search-box" v-if="!isTimeMachineActive">
      <el-input placeholder="请输入地点名称" v-model="searchKeyword" @keyup.enter.native="handleSearch" clearable>
        <el-button slot="append" icon="el-icon-search" @click="handleSearch"></el-button>
      </el-input>
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
import 'leaflet-side-by-side';

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
      allPolygonsData: null,
      allBusData: null,
      lostFoundData: null,

      layerGroups: {
        poi: new L.LayerGroup(),
        building: new L.LayerGroup()
      },
      busLayerGroup: new L.LayerGroup(),
      lostFoundLayerGroup: new L.LayerGroup(),

      currentTool: null,
      measurePoints: [],
      measurePolyline: null,
      routeStart: null,
      routeEnd: null,
      routeLayer: null,

      currentBaseLayer: null,

      isTimeMachineActive: false,
      years: [2003, 2005, 2010, 2014, 2017, 2021, 2025],
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
    this.loadBusData();
    this.loadLostFoundData();
    setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 200);
  },
  methods: {
    initMap() {
      this.map = L.map('map-container', { attributionControl: false }).setView([40.004, 116.358], 16);
      L.control.zoom({ position: 'bottomright' }).addTo(this.map);
      this.switchBaseMap('day');

      this.map.on('click', this.handleMapClick);
      this.map.on('dblclick', this.finishMeasure);

      this.busLayerGroup.addTo(this.map);
      this.lostFoundLayerGroup.addTo(this.map);
    },

    loadData() {
      this.$axios.get('/polygonmodel/all').then(res => {
        this.allPolygonsData = this.convertGeoJSONToGCJ02(res.data);
        this.updateLayer('building', true);
      }).catch(e => console.error("加载建筑物数据失败", e));
    },
    loadBusData() {
      this.$axios.get('/bus/all').then(res => {
        this.allBusData = this.convertGeoJSONToGCJ02(res.data);
        this.updateBusLayer([]);
      }).catch(e => console.error("加载公交数据失败", e));
    },
    loadLostFoundData() {
      this.$axios.get('/lost/list').then(res => {
        this.lostFoundData = this.convertGeoJSONToGCJ02(res.data);
        this.renderLostFound();
      }).catch(e => console.error("加载失物招领失败", e));
    },

    renderLostFound() {
      this.lostFoundLayerGroup.clearLayers();
      if (!this.lostFoundData) return;
      L.geoJSON(this.lostFoundData, {
        onEachFeature: (feature, layer) => {
          const p = feature.properties || {};
          const titleColor = p.lostType === 'lost' ? '#F56C6C' : '#67C23A';
          const typeText = p.lostType === 'lost' ? '寻物启事' : '失物招领';
          const content = `<div style="width: 200px;"><h4 style="margin:0 0 5px 0; color:${titleColor}; border-bottom:1px solid #eee; padding-bottom:5px;">${typeText}: ${p.itemName || ''}</h4><p style="margin:5px 0; color:#666; font-size:13px;">${p.description || ''}</p><p style="margin:5px 0; font-size:12px;"><b>联系人:</b> ${p.visitorName || ''}</p><p style="margin:5px 0; font-size:12px;"><b>联系方式:</b> ${p.contact || ''}</p><p style="margin:5px 0; color:#999; font-size:12px;">${p.createTime || ''}</p></div>`;
          layer.bindPopup(content);
        }
      }).addTo(this.lostFoundLayerGroup);
    },

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

      if (this.currentTool === 'pick-location') {
        const wgs84 = this.gcj02towgs84(latlng.lng, latlng.lat);
        this.$emit('location-picked', { lat: wgs84[1], lng: wgs84[0] });
        this.clearTools();
        return;
      }

      if (this.currentTool === 'measure') {
        this.measurePoints.push(latlng);
        L.circleMarker(latlng, {radius: 4, color: 'red', fillColor: '#f03', fillOpacity: 1}).addTo(this.map);
        if (this.measurePolyline) this.measurePolyline.setLatLngs(this.measurePoints);
        else this.measurePolyline = L.polyline(this.measurePoints, {color: 'red'}).addTo(this.map);
      }
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

    activateTimeMachine() {
      this.isTimeMachineActive = true;
      this.currentYear = this.years[0];
      this.$message.success("欢迎进入时光机！");

      if (this.currentBaseLayer) this.map.removeLayer(this.currentBaseLayer);
      this.map.removeLayer(this.busLayerGroup);
      this.map.removeLayer(this.lostFoundLayerGroup);
      Object.values(this.layerGroups).forEach(g => this.map.removeLayer(g));

      this.historyLayer = L.tileLayer(`http://localhost:8081/cauvisitor/history_tiles/${this.currentYear}/{z}/{x}/{y}.png`, {
        minZoom: 12, maxZoom: 18, tms: false
      }).addTo(this.map);

      this.nowLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        minZoom: 12,
        maxZoom: 18
      }).addTo(this.map);

      this.sideBySideControl = L.control.sideBySide(this.historyLayer, this.nowLayer);
      this.sideBySideControl.addTo(this.map);
    },

    handleYearChange(val) {
      this.currentYear = this.years[val];
      this.$message.info(`切换至 ${this.currentYear} 年`);

      if (this.historyLayer) this.map.removeLayer(this.historyLayer);

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
      this.busLayerGroup.addTo(this.map);
      this.lostFoundLayerGroup.addTo(this.map);
      if (this.allPolygonsData) this.updateLayer('building', true);
      if (this.allBusData) this.updateBusLayer([]);

      this.$message.success("已退出时光机");
    },

    formatTooltip(val) {
      return this.years[val] + '年';
    },

    switchBaseMap(type) {
      if (this.currentBaseLayer) this.map.removeLayer(this.currentBaseLayer);
      let newLayer = null;
      if (type === 'day') newLayer = L.tileLayer('https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}', { subdomains: "1234", attribution: '&copy; 高德地图' });
      else if (type === 'night') newLayer = L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', { subdomains: "1234" });
      else if (type === 'satellite') newLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });
      else if (type === 'hybrid') newLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });
      if (newLayer) {
        newLayer.addTo(this.map);
        if (typeof newLayer.bringToBack === 'function') newLayer.bringToBack();
        this.currentBaseLayer = newLayer;
      }
    },

    updateLayer(type, isVisible) {
      if (!this.allPolygonsData) return;
      const group = this.layerGroups[type];
      if (!isVisible) { if (this.map.hasLayer(group)) this.map.removeLayer(group); return; }
      group.clearLayers();
      L.geoJSON(this.allPolygonsData, {
        filter: (feature) => {
          const name = feature.properties.name || "";
          if (type === 'building') return name.includes('中国农业大学') || name.includes('楼') || name.includes('馆') || name.includes('公寓') || name.includes('宿舍') || name.includes('学院') || name.includes('教学楼') || name.includes('图书馆') || name.includes('体育馆') || name.includes('食堂') || name.includes('大学');
          if (type === 'poi') return name.includes('地铁') || name.includes('站') || name.includes('银行') || name.includes('超市');
          return name.length > 0;
        },
        style: {
          color: '#2d5a27',
          fillColor: '#2d5a27',
          fillOpacity: 0.5,
          weight: 2
        },
        onEachFeature: (feature, layer) => { 
          const name = feature.properties.name || '未命名'; 
          layer.bindPopup(`<strong>${name}</strong>`); 
        }
      }).eachLayer((layer) => group.addLayer(layer));
      this.map.addLayer(group);
    },

    updateBusLayer(targets) {
      this.busLayerGroup.clearLayers();
      if (!this.allBusData) return;
      L.geoJSON(this.allBusData, {
        filter: (feature) => {
          if (!targets || targets.length === 0) return true;
          const name = feature.properties.name || "";
          return targets.some(target => name.includes(target));
        },
        style: () => {
          return { color: "#2d5a27", weight: 5, opacity: 0.8 };
        },
        onEachFeature: (feature, layer) => {
          const p = feature.properties || {};
          layer.bindPopup(`<div style="font-size:14px; width:260px;"><h3 style="margin:0 0 5px 0; color:#2d5a27;">🚌 ${p.name || '公交线路'}</h3></div>`);
        }
      }).eachLayer(layer => this.busLayerGroup.addLayer(layer));
    },

    calculateRealRoute() {
      const p1_gcj = this.routeStart.getLatLng();
      const p2_gcj = this.routeEnd.getLatLng();
      const p1_wgs = this.gcj02towgs84(p1_gcj.lng, p1_gcj.lat);
      const p2_wgs = this.gcj02towgs84(p2_gcj.lng, p2_gcj.lat);
      const loading = this.$loading({ lock: true, text: '正在规划路线...', spinner: 'el-icon-loading', background: 'rgba(0, 0, 0, 0.7)' });
      this.$axios.get('/route/plan', { params: { startLat: p1_wgs[1], startLng: p1_wgs[0], endLat: p2_wgs[1], endLng: p2_wgs[0] } }).then(res => {
        loading.close();
        if (!res.data || !res.data.geometry) { this.$message.warning("无法规划路径，请尝试选择离道路更近的点"); return; }
        const convertedRoute = this.convertGeoJSONToGCJ02(res.data);
        if (this.routeLayer) this.map.removeLayer(this.routeLayer);
        this.routeLayer = L.geoJSON(convertedRoute, { style: {color: 'blue', weight: 6, opacity: 0.8} }).addTo(this.map);
        this.map.fitBounds(this.routeLayer.getBounds(), {padding: [50, 50]});
        this.$message.success("路径规划成功！");
      }).catch(err => { loading.close(); console.error(err); this.$message.error("路径规划服务异常"); });
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

    resetMap() { if (this.map) { this.map.setView([40.004, 116.358], 16); this.$message.success("地图视角已复位"); } },

    gcj02towgs84(lng, lat) {
      const PI = 3.1415926535897932384626;
      const a = 6378245.0;
      const ee = 0.00669342162296594323;
      let dlat = this.transformlat(lng - 105.0, lat - 35.0);
      let dlng = this.transformlng(lng - 105.0, lat - 35.0);
      let radlat = lat / 180.0 * PI;
      let magic = Math.sin(radlat);
      magic = 1 - ee * magic * magic;
      let sqrtmagic = Math.sqrt(magic);
      dlat = (dlat * 180.0) / (a / sqrtmagic * Math.cos(radlat) * PI);
      dlng = (dlng * 180.0) / (a * Math.cos(radlat) * PI);
      let mglat = lat + dlat;
      let mglng = lng + dlng;
      return [lng * 2 - mglng, lat * 2 - mglat];
    },

    transformlat(lat, lng) {
      const PI = 3.1415926535897932384626;
      let ret = -100.0 + 2.0 * lat / 0.01 + 2.0 * lng / 0.01 + lat * lat / 0.01 + 16.0 / 0.01 * lat * lng / 0.01 + lng * lng / 0.01;
      ret += (20.0 * Math.sin(6.0 * lat * PI) + 20.0 * Math.sin(2.0 * lat * PI)) * 2.0 / 3.0;
      ret += (20.0 * Math.sin(lat * PI) + 40.0 * Math.sin(lat / 3.0 * PI)) * 2.0 / 3.0;
      ret += (160.0 * Math.sin(lat / 12.0 * PI) + 320. * Math.sin(lat * PI / 30.0)) * 2.0 / 3.0;
      return ret;
    },

    transformlng(lat, lng) {
      const PI = 3.1415926535897932384626;
      let ret = 300.0 + lat + 2.0 * lng / 0.01 + lat * lat / 0.01 + lat * lng / 0.01 * 20.0;
      ret += (20.0 * Math.sin(6.0 * lat * PI) + 20.0 * Math.sin(2.0 * lat * PI)) * 2.0 / 3.0;
      ret += (20.0 * Math.sin(lat * PI) + 40.0 * Math.sin(lat / 3.0 * PI)) * 2.0 / 3.0;
      ret += (150.0 * Math.sin(lat / 12.0 * PI) + 300.0 * Math.sin(lat / 30.0 * PI)) * 2.0 / 3.0;
      return ret;
    },

    convertGeoJSONToGCJ02(geojson) {
      if (!geojson) return null;
      if (geojson.type === 'FeatureCollection') {
        return { ...geojson, features: geojson.features.map(f => this.convertFeatureToGCJ02(f)) };
      }
      if (geojson.type === 'Feature') return this.convertFeatureToGCJ02(geojson);
      return geojson;
    },

    convertFeatureToGCJ02(feature) {
      if (!feature.geometry) return feature;
      const type = feature.geometry.type;
      const coords = feature.geometry.coordinates;
      let newCoords = coords;
      if (type === 'Point') newCoords = this.gcj02towgs84(coords[0], coords[1]);
      else if (type === 'LineString') newCoords = coords.map(c => this.gcj02towgs84(c[0], c[1]));
      else if (type === 'Polygon') newCoords = [coords[0].map(c => this.gcj02towgs84(c[0], c[1]))];
      else if (type === 'MultiLineString') newCoords = coords.map(line => line.map(c => this.gcj02towgs84(c[0], c[1])));
      else if (type === 'MultiPolygon') newCoords = coords.map(polygon => polygon[0].map(c => this.gcj02towgs84(c[0], c[1])));
      return { ...feature, geometry: { ...feature.geometry, coordinates: newCoords } };
    }
  }
};
</script>

<style scoped>
.container { position: relative; width: 100%; height: 100%; }
#map-container { width: 100%; height: 100%; }
.search-box { position: absolute; top: 10px; left: 70px; z-index: 800; width: 250px; }
.tip-box { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); z-index: 800; background: white; padding: 10px 20px; border-radius: 4px; box-shadow: 0 2px 12px rgba(0,0,0,0.15); }
.time-machine-panel { position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 800; background: white; padding: 15px 20px; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.2); width: 500px; }
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.title { font-weight: bold; font-size: 16px; }
.slider-container { display: flex; align-items: center; }
.year-label { font-weight: bold; color: #2d5a27; }
.panel-tip { margin-top: 10px; font-size: 12px; color: #999; }
</style>
