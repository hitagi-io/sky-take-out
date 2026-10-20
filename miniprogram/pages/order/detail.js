const api = require('../../api/index')
const { orderStatusText, fmtFlavor } = require('../../utils/util')

Page({
  data: {
    order: null,
    statusText: ''
  },

  onLoad(options) {
    this.id = options.id
    this.load()
  },

  onShow() {
    // 已在页面中停留过再回到本页时刷新（如订单被自动取消、商家接单等状态变化）
    if (this.data.order) this.load()
    this.startPolling()
  },

  onHide() {
    this.stopPolling()
  },

  onUnload() {
    this.stopPolling()
  },

  // 页面可见时每 10 秒刷新一次订单状态，商家接单/派送/完成可自动更新
  startPolling() {
    this.stopPolling()
    this._pollTimer = setInterval(() => {
      const order = this.data.order
      if (!order || order.status === 5 || order.status === 6) {
        this.stopPolling()
        return
      }
      if (this._acting) return
      this.load(true)
    }, 10000)
  },

  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer)
      this._pollTimer = null
    }
  },

  load(silent = false) {
    // 竞态守卫：轮询与手动刷新可能并发，只采用最后一次请求的结果
    const seq = (this._detailSeq = (this._detailSeq || 0) + 1)
    return api.getOrderDetail(this.id, { silent }).then((order) => {
      if (seq !== this._detailSeq || !order) return
      const detailList = ((order.orderDetailList) || []).map((it) => ({
        ...it,
        flavorText: fmtFlavor(it.dishFlavor)
      }))
      this.setData({
        order: { ...order, orderDetailList: detailList },
        statusText: orderStatusText(order.status)
      })
      if (order.status === 5 || order.status === 6) {
        this.stopPolling()
      }
    }).catch(() => {})
  },

  // 操作防连点：进行中忽略后续点击
  guard(fn) {
    if (this._acting) return
    this._acting = true
    Promise.resolve()
      .then(fn)
      .finally(() => {
        this._acting = false
      })
  },

  onPay() {
    const order = this.data.order
    this.guard(() =>
      api.payOrder({ orderNumber: order.number, payMethod: 1 })
        .then(() => {
          wx.showToast({ title: '支付成功', icon: 'success' })
          return this.load()
        })
        .catch(() => {})
    )
  },

  onCancel() {
    wx.showModal({
      title: '提示',
      content: '确定取消该订单吗？',
      success: (res) => {
        if (!res.confirm) return
        this.guard(() =>
          api.cancelOrder(this.id)
            .then(() => {
              wx.showToast({ title: '已取消', icon: 'success' })
              return this.load()
            })
            .catch(() => {})
        )
      }
    })
  },

  onRemind() {
    this.guard(() =>
      api.remindOrder(this.id)
        .then(() => wx.showToast({ title: '已催单，请耐心等待', icon: 'none' }))
        .catch(() => {})
    )
  },

  onRepetition() {
    this.guard(() =>
      api.repetitionOrder(this.id)
        .then(() => {
          wx.showToast({ title: '已加入购物车', icon: 'success' })
          setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 600)
        })
        .catch(() => {})
    )
  },

  copyNumber() {
    wx.setClipboardData({ data: this.data.order.number })
  }
})
