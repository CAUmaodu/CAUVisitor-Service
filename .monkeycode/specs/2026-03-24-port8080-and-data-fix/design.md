# 2026-03-24-port8080-and-data-fix

需求名称：port8080-and-data-fix
更新日期：2026-03-24

## 1. 概述

### 1.1 问题描述

1. **端口问题**：前端配置运行在8080端口，但实际启动时被迫使用8082端口
2. **数据不匹配**：前端硬编码的公交线路和POI兴趣点数据与数据库CSV文件内容不匹配

### 1.2 目标

1. 解决前端端口8080无法使用的问题
2. 将前端硬编码的公交线路替换为数据库CSV中的真实数据
3. 将前端POI过滤逻辑替换为基于数据库CSV中真实POI类别的查询

---

## 2. 现状分析

### 2.1 项目架构

```
┌─────────────┐     ┌─────────────┐
│   Frontend  │     │   Backend   │
│  Vue.js     │────▶│  Spring Boot│
│  Port: 8080 │     │  Port: 8081 │
│  (实际8082)  │     │  Context:   │
│             │     │  /cauvisitor│
└─────────────┘     └─────────────┘
```

### 2.2 前端端口配置

| 配置文件 | 当前配置 |
|---------|---------|
| `vue.config.js` | `port: 8080` |
| `package.json` | `--port 8080` |

### 2.3 硬编码数据位置

#### 公交线路 (App.vue:146-159)
```javascript
// 一号环线 (红)
"一号环线（外环主干线）"
"东门站→文科园毓秀路站→..."

// 二号环线 (绿)
"二号环线（内环生活线）"
"东门站→文科园毓秀路站→..."

// 厚德区间 (蓝)
"厚德区间"
"北门站→北体育馆区间→..."
```

#### POI过滤 (CampusMap.vue:293-300)
```javascript
// 食堂
name.includes('餐厅') || name.includes('食堂')
// 景点
name.includes('湖') || name.includes('山') || name.includes('草坪')
// 卫生间
name.includes('厕所') || name.includes('卫生间')
// 建筑
name.includes('楼') || name.includes('馆')
```

### 2.4 数据库CSV数据结构

#### gongjiao.csv (78行，含表头)
| 字段 | 说明 |
|-----|------|
| id | 线路ID |
| osm_id | OSM编号 |
| name | 线路名称 (如 "438路：永丰公交场站 -> 二里庄") |
| type | 类型 (route) |
| other_tags | 包含from、name:zh等元数据 |

#### poi.csv (163行，含表头)
| 字段 | 说明 |
|-----|------|
| id | POI ID |
| osm_id | OSM编号 |
| name | POI名称 |
| barrier | 障碍类型 |
| highway | 道路等级 |
| address | 地址 |
| is_in | 所在区域 |
| place | 地点类型 |
| man_made | 人造物体 |
| other_tags | 包含amenity、bus、name:zh等元数据 |

---

## 3. 解决方案

### 3.1 端口问题解决

#### 方案A：端口检测与自动切换
- 启动前检测8080端口是否可用
- 若被占用，自动尝试8080→8081→8082→...序列
- 提供明确的错误提示

#### 方案B：环境变量配置
- 通过 `.env` 文件配置端口
- 默认使用8080，兼容Docker环境

**推荐：方案B**，简单可靠

### 3.2 公交线路数据替换

#### 3.2.1 解析gongjiao.csv

选择2-3条代表性线路：

| 线路ID | 线路名称 | 选择理由 |
|-------|---------|---------|
| 1 | 438路：永丰公交场站 -> 二里庄 | 包含明确起终点 |
| 16 | 625路：二拨子新村 -> 德胜门 | 跨区域线路 |
| 26 | 466路：地铁北苑站 -> 中关村南 | 经过核心区域 |

#### 3.2.2 数据结构设计

```javascript
// 解析后的公交数据结构
{
  id: 1,
  name: "438路",
  from: "永丰公交场站",
  to: "二里庄",
  stops: "永丰公交场站→...→二里庄",  // CSV中手动补充
  schedule: "每日 7:20 — 21:00",       // CSV中手动补充
  color: "#ff0000"
}
```

#### 3.2.3 地图显示兼容性

为确保点击公交线路能在地图上显示：
- 前端 `updateBusLayer()` 匹配逻辑改为使用真实线路ID
- 或者在 `busRoutes.js` 中维护 `targetKey` 字段（如 `"438"`）用于匹配

```javascript
// 匹配逻辑修改
filter: (feature) => targets.some(target => 
  (feature.properties.name || "").includes(target) ||
  feature.properties.id == targetId
)
```

#### 3.2.4 简化显示方案（最终）

不在CSV中手动补充，简化显示逻辑：

| ID | 线路名 | 起点 | 终点 | 颜色 |
|----|--------|------|------|------|
| 1 | 438路 | 永丰公交场站 | 二里庄 | #ff0000 |
| 16 | 625路 | 二拨子新村 | 德胜门 | #00aa00 |
| 26 | 466路 | 地铁北苑站 | 中关村南 | #0000ff |

**前端显示格式：**
```
途经站点：永丰公交场站 → 二里庄
运行时间：每日运营（数据来源：gongjiao.csv）
```

### 3.3 POI兴趣点数据替换

#### 3.3.1 POI类别分析

从poi.csv的`other_tags`字段提取常见类别：

| 类别 | 关键字 | 示例POI |
|-----|-------|--------|
| 餐饮 | cafe, fast_food, restaurant | 星巴克、肯德基 |
| 交通 | bus, stop_position | 双泉堡、望京西 |
| 教育 | college, school, kindergarten | 中国农业大学、北京林业大学 |
| 医疗 | hospital, pharmacy | 北京京城皮肤病医院 |

#### 3.3.2 过滤逻辑优化

```javascript
// 基于other_tags解析的POI类别
const poiCategories = {
  canteen: ['restaurant', 'fast_food', 'cafe'],
  education: ['college', 'school', 'kindergarten'],
  transport: ['bus', 'stop_position'],
  hospital: ['hospital', 'pharmacy']
};
```

---

## 4. 技术设计

### 4.1 前端结构调整

```
frontend/src/
├── data/
│   ├── busRoutes.js      # 新增：从CSV解析的公交数据
│   └── poiCategories.js   # 新增：POI类别配置
├── components/
│   └── CampusMap.vue      # 修改：使用新的POI过滤逻辑
└── App.vue                # 修改：使用新的公交数据
```

### 4.2 新增文件设计

#### 4.2.1 busRoutes.js

```javascript
// 从 gongjiao.csv 解析的公交线路数据
export default [
  {
    id: 1,
    name: "438路",
    from: "永丰公交场站",
    to: "二里庄",
    stops: "永丰公交场站→...→二里庄",
    schedule: "每日运营",
    color: "#ff0000",
    displayName: "438路（外环线）"
  },
  // ... 选择2-3条线路
]
```

#### 4.2.2 poiCategories.js

```javascript
// 从 poi.csv 解析的POI类别配置
export default {
  canteen: {
    label: "餐饮",
    keywords: ["restaurant", "fast_food", "cafe"],
    icon: "el-icon-food"
  },
  education: {
    label: "教育",
    keywords: ["college", "school", "kindergarten"],
    icon: "el-icon-reading"
  },
  transport: {
    label: "交通站点",
    keywords: ["bus", "stop_position"],
    icon: "el-icon-location"
  },
  hospital: {
    label: "医疗",
    keywords: ["hospital", "pharmacy"],
    icon: "el-icon-first-aid-kit"
  }
}
```

### 4.3 端口配置方案

#### 4.3.1 创建 .env 文件

```env
VUE_APP_PORT=8080
```

#### 4.3.2 修改 vue.config.js

```javascript
const port = process.env.VUE_APP_PORT || 8080;

module.exports = defineConfig({
  devServer: {
    port: port,
    proxy: { ... }
  }
});
```

### 4.4 后端接口验证

确认现有接口返回数据格式：

| 接口 | 返回类型 | 用途 |
|-----|---------|-----|
| GET /bus/all | GeoJSON | 公交线路图层 |
| GET /pointmodel/all | GeoJSON | POI点数据 |
| GET /polygonmodel/search | GeoJSON | 地点搜索 |

---

## 5. 数据解析实现

### 5.1 CSV解析脚本 (Python)

```python
import csv
import json

def parse_gongjiao():
    routes = []
    with open('gongjiao.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i >= 3:  # 只取前3条
                break
            # 解析other_tags
            tags = eval(row['other_tags'])
            routes.append({
                'id': row['id'],
                'name': row['name'].split('：')[0],  # "438路"
                'from': tags.get('from', ''),
                'to': tags.get('name:zh', '').split(' -> ')[-1] if '->' in tags.get('name:zh', '') else ''
            })
    return routes

def parse_poi_categories():
    categories = set()
    with open('poi.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            tags = eval(row['other_tags']) if row['other_tags'] else {}
            if 'amenity' in tags:
                categories.add(tags['amenity'])
            if 'bus' in tags:
                categories.add('bus_stop')
    return list(categories)
```

### 5.2 解析结果

#### 公交线路 (选择3条)

| ID | 线路名 | 起点 | 终点 |
|----|--------|------|------|
| 1 | 438路 | 永丰公交场站 | 二里庄 |
| 16 | 625路 | 二拨子新村 | 德胜门 |
| 26 | 466路 | 地铁北苑站 | 中关村南 |

#### POI类别统计

| 类别 | 数量 | 示例 |
|------|------|------|
| cafe | ~5 | 星巴克 |
| fast_food | ~10 | 肯德基 |
| bus_stop | ~50 | 双泉堡、望京西 |
| stop_position | ~30 | 地铁站 |
| college | ~5 | 中国农业大学 |

---

## 6. 实施步骤

### 步骤1：端口问题修复
1. 创建 `frontend/.env` 文件
2. 修改 `vue.config.js` 读取环境变量
3. 验证端口配置生效

### 步骤2：公交数据替换
1. 创建 `frontend/src/data/busRoutes.js`
2. 解析 gongjiao.csv 选择2-3条线路
3. 修改 App.vue 公交展示逻辑
4. 修改 CampusMap.vue 公交过滤逻辑

### 步骤3：POI数据替换
1. 创建 `frontend/src/data/poiCategories.js`
2. 解析 poi.csv 提取类别
3. 修改 CampusMap.vue 过滤逻辑
4. 测试各类别POI显示

### 步骤4：验证测试
1. 启动前端验证端口
2. 验证公交线路选择功能
3. 验证POI分类显示功能

---

## 7. 风险与注意事项

### 7.1 端口冲突
- 若8080被占用，需提供备选端口序列
- 建议添加端口占用检测脚本

### 7.2 数据完整性
- CSV解析需处理特殊字符
- 坐标系转换（WGS84与GCJ02）

### 7.3 向后兼容
- 保留现有API接口不变
- 新数据结构需兼容现有渲染逻辑

---

## 8. 参考文件

- `frontend/vue.config.js`
- `frontend/src/App.vue`
- `frontend/src/components/CampusMap.vue`
- `gongjiao.csv` - 公交线路数据
- `poi.csv` - POI兴趣点数据
