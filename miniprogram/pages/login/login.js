const { login } = require('../../api/index')

Page({
  data: {
    loading: false
  },

  onLoad() {
    this._closed = false
  },

  // 用户点击授权后才调用 wx.login 换取 code 登录
  onAuthLogin() {
    if (this.data.loading) return
    this.setData({ loading: true })
    wx.login({
      success: (res) => {
        if (!res.code) {
          this.setData({ loading: false })
          wx.showToast({ title: '微信登录失败，请重试', icon: 'none' })
          return
        }
        login(res.code)
          .then((data) => {
            const app = getApp()
            // 页面已被用户关闭：只落 token，不再做任何跳转
            if (this._closed) {
              app.onLoginSuccess(data.token)
              return
            }
            // 先写入 token（下个页面 onShow 能读到），等登录页退栈后再放行挂起请求
            app.onLoginSuccess(data.token, true)
            wx.showToast({ title: '登录成功', icon: 'success' })
            setTimeout(() => {
              if (this._closed) {
                app.flushLoginWaiters()
                return
              }
              this.goBack(() => app.flushLoginWaiters())
            }, 600)
          })
          .catch(() => {
            if (!this._closed) this.setData({ loading: false })
          })
      },
      fail: () => {
        if (!this._closed) this.setData({ loading: false })
        wx.showToast({ title: '微信登录失败，请重试', icon: 'none' })
      }
    })
  },

  onCancel() {
    getApp().onLoginCancel()
    this.goBack()
  },

  // 用户通过左滑/返回键直接关闭登录页时，也要释放挂起的请求
  onUnload() {
    this._closed = true
    const app = getApp()
    if (!app.globalData.token) {
      app.onLoginCancel()
    }
    // 已登录但等待队列尚未放行的情况，交给成功回调里的定时器处理
  },

  goBack(done) {
    const pages = getCurrentPages()
    const after = () => {
      if (done) done()
    }
    if (pages.length > 1) {
      wx.navigateBack({ success: after, fail: after })
    } else {
      wx.reLaunch({ url: '/pages/index/index', success: after, fail: after })
    }
  }
})
