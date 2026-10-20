App({
  globalData: {
    token: ''
  },

  onLaunch() {
    const token = wx.getStorageSync('token')
    if (token) {
      this.globalData.token = token
    }
    // 已移除自定义头像昵称功能，清理旧版本遗留的本地缓存
    wx.removeStorageSync('avatarUrl')
    wx.removeStorageSync('nickName')
    this._loginWaiters = [] // 等待授权结果的请求队列
    this._redirectingLogin = false
  },

  // 确保已登录。未登录时不静默登录，而是跳转授权页，由用户点击"微信授权登录"后才真正登录。
  // 并发调用共享同一次跳转，所有请求挂起直到授权完成或被取消。
  ensureLogin() {
    if (this.globalData.token) {
      return Promise.resolve(this.globalData.token)
    }
    if (!this._redirectingLogin) {
      this._redirectingLogin = true
      wx.navigateTo({
        url: '/pages/login/login',
        fail: () => {
          // 页面栈已满等异常情况：放行失败，让挂起的请求自然报错
          this._redirectingLogin = false
          this._flushLoginWaiters(new Error('login page unavailable'))
        }
      })
    }
    return new Promise((resolve, reject) => {
      this._loginWaiters.push({ resolve, reject })
    })
  },

  // 登录页授权成功。deferFlush=true 时先写入 token，等登录页返回后再放行挂起的请求，
  // 避免请求回调在登录页还没退栈时执行 navigateTo，导致页面栈错乱。
  onLoginSuccess(token, deferFlush) {
    this.globalData.token = token
    wx.setStorageSync('token', token)
    this._redirectingLogin = false
    if (!deferFlush) {
      this._flushLoginWaiters(null, token)
    }
  },

  // 登录页已退栈，放行等待中的请求
  flushLoginWaiters() {
    if (this.globalData.token) {
      this._flushLoginWaiters(null, this.globalData.token)
    }
  },

  // 用户取消授权
  onLoginCancel() {
    this._redirectingLogin = false
    this._flushLoginWaiters(new Error('login cancelled'))
  },

  _flushLoginWaiters(err, token) {
    const waiters = this._loginWaiters.splice(0)
    waiters.forEach((w) => (err ? w.reject(err) : w.resolve(token)))
  },

  logout() {
    this.globalData.token = ''
    wx.removeStorageSync('token')
  }
})
