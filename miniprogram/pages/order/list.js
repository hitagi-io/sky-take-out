const api = require('../../api/index')
const { orderStatusText } = require('../../utils/util')

const TABS = [
  { label: '全部', status: null },
  { label: '待付款', status: 1 },
  { label: '进行中', status: null, inProgress: true },
  { label: '已完成', status: 5 },
  { label: '已取消', status: 6 }
]

const decorate = (o) => ({
  ...o,
  statusText: orderStatusText(o.status),
  firstImage: o.orderDetailList && o.orderDetailList.length ? o.orderDetailList[0].image : ''
})

Page({
  data: {
    tabs: TABS,
    activeTab: 0,
    orders: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    refreshing: false
  },

  onLoad(options) {
    // 从“我的”订单入口带入目标 Tab
    if (options && options.tab !== undefined) {
      const index = Number(options.tab)
      if (index >= 0 && index < TABS.length) {
        this.setData({ activeTab: index })
      }
    }
  },

  onShow() {
    // 返回列表时已有数据则静默刷新，避免整页闪白
    this.reload(this.data.orders.length > 0)
    this.startPolling()
  },

  onHide() {
    this.stopPolling()
  },

  onUnload() {
    this.stopPolling()
  },

  onRefresh() {
    this.setData({ refreshing: true })
    this.reload(true).finally(() => this.setData({ refreshing: false }))
  },

  // 页面可见时每 10 秒同步一次已展示订单的状态，不打乱列表和滚动位置
  startPolling() {
    this.stopPolling()
    this._pollTimer = setInterval(() => this.pollOrders(), 10000)
  },

  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer)
      this._pollTimer = null
    }
  },

  pollOrders() {
    if (this._polling || this.data.loading || !this.data.orders.length) return
    const tabIndex = this.data.activeTab
    const tab = TABS[tabIndex]
    if (!tab) return

    this._polling = true
    // 用不带状态条件的最近订单来对比，才能发现订单状态已变化（如待付款已支付、进行中已完成）
    api.getHistoryOrders(1, this.data.pageSize, null, { silent: true })
      .then((res) => {
        // 轮询期间用户切换了 Tab，丢弃本次结果
        if (tabIndex !== this.data.activeTab) return
        const recordMap = {}
        ;((res && res.records) || []).forEach((o) => {
          recordMap[o.id] = decorate(o)
        })
        let changed = false
        const mapped = this.data.orders.map((o) => {
          const fresh = recordMap[o.id]
          if (!fresh) return o
          if (fresh.status === o.status && fresh.amount === o.amount) return o
          changed = true
          return { ...o, status: fresh.status, statusText: fresh.statusText, amount: fresh.amount }
        })
        // 状态已不匹配当前 Tab 的订单自动移出列表（如待付款已支付、进行中已完成）
        const keep = (o) => {
          if (tab.inProgress) return o.status === 2 || o.status === 3 || o.status === 4
          if (tab.status !== null) return o.status === tab.status
          return true
        }
        const orders = mapped.filter(keep)
        if (orders.length === 0 && this.data.hasMore) {
          // 当前页订单都已流转到其他状态，重新拉取以补齐后续订单
          this.reload(true)
          return
        }
        if (changed || orders.length !== this.data.orders.length) {
          this.setData({ orders })
        }
      })
      .catch(() => {})
      .finally(() => {
        this._polling = false
      })
  },

  onTapTab(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (index === this.data.activeTab) return
    this.setData({ activeTab: index })
    this.reload()
  },

  reload(silent = false) {
    this._inProgressNextPage = 1
    if (silent) {
      // 静默刷新：保留当前列表，数据回来后再替换，避免闪白
      this.setData({ page: 1, hasMore: true })
    } else {
      this.setData({ page: 1, orders: [], hasMore: true })
    }
    return this.fetch()
  },

  loadMore() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ page: this.data.page + 1 })
    this.fetch()
  },

  fetch() {
    const tab = TABS[this.data.activeTab]
    this.setData({ loading: true })
    // 竞态守卫：切 Tab / 连续翻页时，过期响应直接丢弃
    const seq = (this._fetchSeq = (this._fetchSeq || 0) + 1)
    const page = this.data.page

    if (tab.inProgress) {
      // “进行中”后端没有组合状态，需循环拉取直到凑满一页或全部拉完，
      // 否则前端过滤后可能出现“本页为空但后面还有进行中订单”。
      // 后端页码用独立游标跟踪（过滤后 UI 页码与后端页码不再对应）
      return this.fetchInProgress(seq, this._inProgressNextPage || 1, [])
    }

    return api.getHistoryOrders(page, this.data.pageSize, tab.status)
      .then((res) => {
        if (seq !== this._fetchSeq) return
        const records = ((res && res.records) || []).map(decorate)
        const total = (res && res.total) || 0
        const orders = page === 1 ? records : this.data.orders.concat(records)
        this.setData({
          orders,
          hasMore: orders.length < total && records.length > 0,
          loading: false
        })
      })
      .catch(() => {
        if (seq !== this._fetchSeq) return
        // 加载失败回退页码，避免重试时跳过一页
        this.setData({ loading: false, page: Math.max(1, this.data.page - 1) })
      })
  },
  // 进行中订单：从第 startPage 页开始循环拉取并过滤，直到凑满 pageSize 条或没有更多
  fetchInProgress(seq, startPage, acc) {
    const pageSize = this.data.pageSize
    return api.getHistoryOrders(startPage, pageSize, null)
      .then((res) => {
        if (seq !== this._fetchSeq) return
        const records = ((res && res.records) || []).map(decorate)
        const total = (res && res.total) || 0
        const matched = acc.concat(records.filter((o) => o.status === 2 || o.status === 3 || o.status === 4))
        const reachedEnd = startPage * pageSize >= total || records.length === 0
        if (matched.length < pageSize && !reachedEnd) {
          return this.fetchInProgress(seq, startPage + 1, matched)
        }
        const orders = this.data.page === 1 ? matched : this.data.orders.concat(matched)
        this.setData({
          orders,
          hasMore: !reachedEnd,
          loading: false
        })
        // 记录下次续拉的后端页码
        this._inProgressNextPage = startPage + 1
      })
      .catch(() => {
        if (seq !== this._fetchSeq) return
        this.setData({ loading: false, page: Math.max(1, this.data.page - 1) })
      })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/order/detail?id=${id}` })
  },

  // 去支付（待付款订单），防连点
  onPay(e) {
    if (this._paying) return
    const order = e.currentTarget.dataset.order
    this._paying = true
    api.payOrder({ orderNumber: order.number, payMethod: 1 })
      .then(() => {
        wx.showToast({ title: '支付成功', icon: 'success' })
        this.reload()
      })
      .catch(() => {})
      .finally(() => {
        this._paying = false
      })
  },

  onCancel(e) {
    const order = e.currentTarget.dataset.order
    wx.showModal({
      title: '提示',
      content: '确定取消该订单吗？',
      success: (res) => {
        if (!res.confirm || this._acting) return
        this._acting = true
        api.cancelOrder(order.id)
          .then(() => {
            wx.showToast({ title: '已取消', icon: 'success' })
            this.reload()
          })
          .catch(() => {})
          .finally(() => {
            this._acting = false
          })
      }
    })
  },

  onRemind(e) {
    if (this._acting) return
    const order = e.currentTarget.dataset.order
    this._acting = true
    api.remindOrder(order.id)
      .then(() => wx.showToast({ title: '已催单，请耐心等待', icon: 'none' }))
      .catch(() => {})
      .finally(() => {
        this._acting = false
      })
  },

  onRepetition(e) {
    if (this._acting) return
    const order = e.currentTarget.dataset.order
    this._acting = true
    api.repetitionOrder(order.id)
      .then(() => {
        wx.showToast({ title: '已加入购物车', icon: 'success' })
        setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 600)
      })
      .catch(() => {})
      .finally(() => {
        this._acting = false
      })
  },

  goOrder() {
    wx.reLaunch({ url: '/pages/index/index' })
  }
})
