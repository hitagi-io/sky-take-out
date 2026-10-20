const api = require('../../api/index')

Page({
  data: {
    list: [],
    from: '' // from=confirm 时点击地址即选中返回
  },

  onLoad(options) {
    this.setData({ from: options.from || '' })
  },

  onShow() {
    this.load()
  },

  load() {
    return api.getAddressList()
      .then((list) => this.setData({ list: list || [] }))
      .catch(() => {})
  },

  onTapAddress(e) {
    const item = e.currentTarget.dataset.item
    if (this.data.from === 'confirm') {
      // 确认订单页进入：选中后回传
      wx.setStorageSync('pickedAddress', item)
      wx.navigateBack()
    } else {
      this.onEdit(e)
    }
  },

  onAdd() {
    wx.navigateTo({ url: '/pages/address/edit' })
  },

  onEdit(e) {
    const id = e.currentTarget.dataset.item.id
    wx.navigateTo({ url: `/pages/address/edit?id=${id}` })
  },

  onSetDefault(e) {
    const item = e.currentTarget.dataset.item
    api.setDefaultAddress(item.id)
      .then(() => this.load())
      .catch(() => {})
  },

  onDelete(e) {
    const item = e.currentTarget.dataset.item
    wx.showModal({
      title: '提示',
      content: `确定删除地址「${item.label || item.detail}」吗？`,
      success: (res) => {
        if (res.confirm) {
          api.deleteAddress(item.id)
            .then(() => {
              wx.showToast({ title: '已删除', icon: 'success' })
              this.load()
            })
            .catch(() => {})
        }
      }
    })
  }
})
