const api = require('../../api/index')
const { fmtPrice, fmtDateTime, fmtFlavor } = require('../../utils/util')

Page({
  data: {
    address: null,
    cartList: [],
    totalAmount: '0.00',
    packAmount: 0,
    remark: '',
    tablewareStatus: 1, // 1 按餐量提供 0 选择数量
    tablewareNumber: 1,
    submitting: false,
    // 支付弹窗
    payOrder: null // {id, orderNumber, orderAmount, orderTime}
  },

  onShow() {
    // 从地址页返回时刷新（地址页会通过 storage 告知选中的地址）
    const picked = wx.getStorageSync('pickedAddress')
    if (picked) {
      wx.removeStorageSync('pickedAddress')
      this.setData({ address: picked })
    } else if (this.data.address) {
      // 已选地址可能被编辑过，静默同步最新内容
      api.getAddressById(this.data.address.id, { silent: true })
        .then((addr) => {
          if (addr) this.setData({ address: addr })
        })
        .catch(() => {})
    } else {
      // 仅在还没有地址时加载默认地址，避免覆盖用户手动选择的结果
      this.loadDefaultAddress()
    }
    this.loadCart()
  },

  loadDefaultAddress() {
    api.getDefaultAddress()
      .then((addr) => this.setData({ address: addr || null }))
      .catch(() => {})
  },

  loadCart() {
    api.getCartList()
      .then((list) => {
        list = (list || []).map((it) => ({ ...it, flavorText: fmtFlavor(it.dishFlavor) }))
        let total = 0
        list.forEach((it) => (total += it.amount * it.number))
        this.setData({ cartList: list, totalAmount: fmtPrice(total) })
      })
      .catch(() => {})
  },

  onInputRemark(e) {
    this.setData({ remark: e.detail.value })
  },

  onTablewareMode(e) {
    this.setData({ tablewareStatus: Number(e.currentTarget.dataset.mode) })
  },

  onTablewareNum(e) {
    this.setData({ tablewareNumber: Number(e.detail.value) + 1 })
  },

  goAddressList() {
    wx.navigateTo({ url: '/pages/address/list?from=confirm' })
  },

  onSubmit() {
    if (this.data.submitting) return
    if (!this.data.address) {
      wx.showToast({ title: '请先选择收货地址', icon: 'none' })
      return
    }
    if (!this.data.cartList.length) {
      wx.showToast({ title: '购物车是空的', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    const data = {
      addressBookId: this.data.address.id,
      payMethod: 1, // 微信支付
      remark: this.data.remark,
      deliveryStatus: 1, // 立即送出
      estimatedDeliveryTime: fmtDateTime(new Date(Date.now() + 40 * 60 * 1000)),
      tablewareStatus: this.data.tablewareStatus,
      tablewareNumber: this.data.tablewareStatus === 0 ? this.data.tablewareNumber : 1,
      packAmount: this.data.packAmount,
      amount: Number(this.data.totalAmount) + this.data.packAmount
    }
    api.submitOrder(data)
      .then((vo) => {
        this.setData({ payOrder: vo, submitting: false })
      })
      .catch(() => this.setData({ submitting: false }))
  },

  // 模拟支付：后端 payment 接口会直接完成支付并改单（防连点）
  onPay() {
    const order = this.data.payOrder
    if (!order || this._paying) return
    this._paying = true
    api.payOrder({ orderNumber: order.orderNumber, payMethod: 1 })
      .then(() => {
        wx.showToast({ title: '支付成功', icon: 'success' })
        this.setData({ payOrder: null })
        setTimeout(() => {
          wx.redirectTo({ url: `/pages/order/detail?id=${order.id}` })
        }, 800)
      })
      .catch(() => {})
      .finally(() => {
        this._paying = false
      })
  },

  onCancelPay() {
    const order = this.data.payOrder
    if (!order) return // 防连点：弹窗已关闭时不再跳转
    this.setData({ payOrder: null })
    wx.redirectTo({ url: `/pages/order/detail?id=${order.id}` })
  }
})
