Page({
  data: {
    loggedIn: false
  },

  onShow() {
    this.setData({ loggedIn: !!getApp().globalData.token })
  },

  // 未登录时点击用户信息区域，跳转授权页
  onTapLogin() {
    if (this.data.loggedIn) return
    getApp().ensureLogin()
      .then(() => this.setData({ loggedIn: true }))
      .catch(() => {})
  },

  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      confirmColor: '#ef4444',
      success: (res) => {
        if (!res.confirm) return
        getApp().logout()
        this.setData({ loggedIn: false })
        wx.showToast({ title: '已退出登录', icon: 'success' })
      }
    })
  },

  requireLogin(fn) {
    if (getApp().globalData.token) {
      fn()
      return
    }
    getApp().ensureLogin()
      .then(() => {
        this.setData({ loggedIn: true })
        fn()
      })
      .catch(() => {})
  },

  goOrders(e) {
    const tab = Number(e.currentTarget.dataset.tab || 0)
    this.requireLogin(() => wx.navigateTo({ url: `/pages/order/list?tab=${tab}` }))
  },

  goAddress() {
    this.requireLogin(() => wx.navigateTo({ url: '/pages/address/list' }))
  }
})
