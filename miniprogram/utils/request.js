const { baseUrl } = require('./config')

// 剔除 null/undefined/空串参数：wx.request 会把 null 序列化成字符串 "null"，
// 后端按 Integer 绑定会抛异常（历史订单"未知错误"就是这个原因）
function cleanParams(data) {
  const out = {}
  Object.keys(data || {}).forEach((k) => {
    if (data[k] !== null && data[k] !== undefined && data[k] !== '') {
      out[k] = data[k]
    }
  })
  return out
}

// 统一请求封装：未登录先跳授权页、自动带 token、401 重新授权后重试一次
// opts.auth=false 表示公开接口（店铺状态/分类/菜品/套餐），游客可访问，不强制登录
function request(url, method = 'GET', data = {}, opts = {}) {
  const { silent = false, auth = true, retried = false } = opts
  const app = getApp()

  const send = (token) =>
    new Promise((resolve, reject) => {
      wx.request({
        url: baseUrl + url,
        method,
        data: cleanParams(data),
        header: {
          'content-type': 'application/json',
          authentication: token || ''
        },
        success: (res) => {
          // 后端统一返回 Result：{code, msg, data}，code=1 成功
          if (res.statusCode === 200 && res.data && res.data.code === 1) {
            resolve(res.data.data)
            return
          }
          // token 失效：清除后重新走授权流程，成功后只重试一次，避免 401 循环
          if (res.statusCode === 401 && auth && !retried) {
            app.logout()
            app.ensureLogin()
              .then(() => request(url, method, data, { ...opts, retried: true }).then(resolve).catch(reject))
              .catch(reject)
            return
          }
          const msg = (res.data && res.data.msg) || '请求失败，请稍后再试'
          if (!silent) {
            wx.showToast({ title: msg, icon: 'none' })
          }
          reject(new Error(msg))
        },
        fail: () => {
          if (!silent) {
            wx.showToast({ title: '网络异常，请检查服务是否启动', icon: 'none' })
          }
          reject(new Error('network error'))
        }
      })
    })

  if (!auth) {
    return send(app.globalData.token)
  }
  return app.ensureLogin().then((token) => send(token))
}

module.exports = {
  get: (url, data, opts) => request(url, 'GET', data, opts),
  post: (url, data, opts) => request(url, 'POST', data, opts),
  put: (url, data, opts) => request(url, 'PUT', data, opts),
  del: (url, data, opts) => request(url, 'DELETE', data, opts)
}
