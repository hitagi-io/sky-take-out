# 天空外卖

前后端分离的外卖点餐管理系统，面向单店经营的中小餐饮商家。

## 目录

- [功能概览](#功能概览)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [许可证](#许可证)

## 功能概览

### 商家端

- **账号安全**：登录、退出登录、修改密码等账号操作的安全机制如下：
  - 令牌鉴权：登录成功后签发令牌（JWT），后续请求凭该令牌鉴权。
  - 令牌失效：角色或密码变更、账号被禁用后，旧令牌立即失效。
  - 密码存储：密码用 Argon2id 存储。
  - 登录锁定：同一账号在同一 IP 下 15 分钟内输错 5 次即锁定；账号不存在时也走同样的校验流程，避免被用于试探用户名是否存在。
- **角色权限**：店员只能操作菜单分类、菜品、套餐、订单等基础业务；店长除此之外还可以管理员工账号（查询、新增、编辑、启用/禁用）、查看数据统计、切换店铺营业状态。店长新增或编辑员工时可指定其角色，未指定默认为店员。系统始终保留至少一名启用中的店长，不允许把最后一名店长降级为店员。
- **菜品管理**：支持新增菜品（含口味）、分页查询、按分类查询、编辑、批量删除和起售/停售；停售菜品时会同步停售关联套餐。
- **套餐管理**：支持新增套餐（可关联菜品）、分页查询、编辑、批量删除和起售/停售。
- **订单管理**：支持条件分页查询与查看订单详情，以及接单、拒单、派单、完成、取消订单等操作，并统计各状态订单数量。
- **工作台**：展示今日营业数据（营业额、有效订单、客单价等），以及订单总览、菜品总览和套餐总览。
- **数据统计**：提供营业额统计、用户统计、订单统计和销量 Top 10。
- **店铺状态**：设置与查询营业/打烊状态，结果存入 Redis；打烊后会拒绝新订单提交与待支付订单继续支付。

### 用户端

- **登录**：微信小程序登录。小程序把临时登录凭证发给后端，后端据此调用微信接口换取用户唯一标识 `openid`，再签发用户端令牌（JWT）。
- **点餐**：按菜单分类浏览菜品与套餐，可查看套餐所含菜品。
- **购物车**：支持添加商品、减少商品、查询列表和清空购物车。
- **地址簿**：支持地址的新增、编辑、删除和查询，以及默认地址的设置与查询。
- **下单与支付**：支持提交订单、订单支付（当前为模拟支付，未接入微信支付）、历史订单分页查询、订单详情、取消订单和再来一单；待付款订单可取消或支付。
- **催单**：可对进行中的订单催单，触发商家端实时提醒。

### 通用能力

- **鉴权与安全**：商家端与用户端各自使用独立的 JWT 密钥。商家端的店长专属接口还会再按角色做二次鉴权。
- **缓存**：用 Redis 缓存菜品和套餐的查询结果，增删改与起售/停售时同步清理。
- **实时提醒**：通过 WebSocket 向来单/催单推送消息给商家端。建立连接时后端会校验商家端令牌，未授权的连接会被直接拒绝。
- **定时任务**：每 2 分钟自动取消超过 15 分钟未支付的订单；每小时将配送中超过 3 小时的订单自动完成。
- **文件上传**：图片上传至阿里云 OSS。
- **支付回调（预留）**：已实现微信支付成功回调的接收、AES 解密，以及解密后更新订单状态并触发来单提醒；因当前是模拟支付，该回调实际不会被触发。
- **统一处理**：全局异常处理器与统一的 `Result` 响应结构。

## 技术栈

| 层级 | 模块 | 技术 |
| --- | --- | --- |
| 后端 | 应用服务 | Java 17、Spring Boot 2.7.3、MyBatis、PageHelper、Druid、MySQL、Redis、WebSocket、JWT、Argon2id、Lombok、fastjson、Apache HttpClient、微信支付 APIv3 SDK、阿里云 OSS、Maven |
| 前端 | 商家端 | Vue 3、Vite 5、TypeScript、Element Plus、Pinia、Vue Router、ECharts、Axios、Day.js |
| 前端 | 用户端 | 原生微信小程序（WXML、WXSS、JavaScript） |

## 项目结构

```text
sky-take-out
├── merchant-admin    # 商家端（Vue 3 + Vite），面向店长与店员
├── miniprogram       # 用户端（原生微信小程序），面向顾客
├── sky-common        # 后端公共模块：常量、上下文、异常、统一结果、工具类等
├── sky-pojo          # 后端数据模型：Entity、DTO、VO
├── sky-server        # 后端核心模块：启动入口与全部业务实现
│   ├── SkyApplication.java
│   ├── config        # 配置类：MVC、Redis、WebSocket、OSS
│   ├── controller    # 接口层，按访问端分包：admin 商家端、user 用户端、notify 支付回调
│   ├── handler       # 全局异常处理
│   ├── interceptor   # 拦截商家端与用户端的 JWT，并按角色鉴权
│   ├── mapper        # MyBatis 持久层接口
│   ├── service       # 业务层
│   ├── task          # 定时任务：订单超时取消、配送超时自动完成
│   └── websocket     # 来单/催单提醒推送
├── sql               # 建库建表与初始数据
├── pom.xml           # 父 POM，聚合后端三个模块
├── .gitignore        # Git 忽略规则
├── LICENSE           # MIT 许可证
└── README.md         # 项目说明
```

## 快速开始

### 1. 环境要求

| 环境 | 建议版本 |
| --- | --- |
| JDK | 17 |
| Maven | 3.8+ |
| Node.js | 18+（含 npm） |
| MySQL | 8.0+ |
| Redis | 5+（Windows 可使用 Memurai 等兼容实现） |
| 微信开发者工具 | 需支持基础库 3.17.4 |

### 2. 配置

#### 2.1 后端

`sky-server/src/main/resources/application-dev.yml` 被 `.gitignore` 排除，拉取代码后需自行创建，否则 `${sky.*}` 占位符无法解析，后端将无法启动：

```yaml
sky:
  datasource:
    driver-class-name: com.mysql.cj.jdbc.Driver
    host: localhost
    port: 3306
    database: sky_take_out
    username: root
    password: 你的数据库密码
  redis:
    host: localhost
    port: 6379
  jwt:
    admin-secret-key: "请替换为随机字符串"
    user-secret-key: "请替换为另一段随机字符串"
  alioss:
    endpoint: oss-cn-beijing.aliyuncs.com
    access-key-id: 你的 AccessKeyId
    access-key-secret: 你的 AccessKeySecret
    bucket-name: 你的 BucketName
  wechat:
    appid: 你的小程序 AppID
    secret: 你的小程序 Secret
```

- **阿里云 OSS**：可先填占位值；未配置只会导致商家端无法上传图片，其余功能不受影响。

#### 2.2 用户端

- **AppID**：把 `miniprogram/project.config.json` 中的 `appid`（现为占位值）替换为自己的小程序 AppID，并与后端 `sky.wechat.appid` 保持一致。
- **后端地址**：`miniprogram/utils/config.js` 中的 `baseUrl` 指向后端服务，本地开发保持默认即可：

  ```js
  module.exports = {
    baseUrl: 'http://localhost:8080'
  }
  ```

- **域名校验**：项目已在 `miniprogram/project.config.json` 中关闭域名校验（`"urlCheck": false`），对应开发者工具里的“开发环境不校验请求域名、TLS 版本及 HTTPS 证书”选项。因此：
  - 在微信开发者工具模拟器中可直接访问 `localhost`。
  - 改用真机调试时，把 `baseUrl` 换成电脑的局域网 IP（手机上的 `localhost` 指向手机自身）。同时确保手机与电脑处于同一局域网、电脑防火墙已放行 `8080` 端口；真机调试属于调试模式，同样不会校验域名。
- **上线注意事项**：上线前把 `baseUrl` 换成已备案的 HTTPS 域名（如 `https://api.example.com`），并在微信公众平台“开发管理 → 开发设置 → 服务器域名”的 request 合法域名中添加该域名，不支持 IP、`localhost` 或 `http`。

### 3. 初始化数据库

以 DataGrip 为例（其他数据库管理软件操作类似）：新建项目并配置 MySQL 数据源，然后在查询控制台运行 `sql/origin.sql`。脚本会创建 `sky_take_out` 数据库、11 张表和初始店长账号 `admin`，密码 `123456`（存储形式为无盐 MD5，首次登录后自动升级为 Argon2id），建议登录后立即修改。

### 4. 启动后端

在 IDE 中直接运行 `com.sky.SkyApplication` 即可启动后端，默认端口 `8080`。

### 5. 启动前端

#### 5.1 商家端

```bash
cd merchant-admin
npm install
npm run dev
```

启动后浏览器访问 `http://localhost:5173`。

#### 5.2 用户端

在微信开发者工具中导入 `miniprogram` 目录，信任并运行。

## 许可证

[MIT](./LICENSE)
