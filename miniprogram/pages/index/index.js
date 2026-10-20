const api = require('../../api/index')
const { fmtPrice, fmtFlavor } = require('../../utils/util')

Page({
  data: {
    statusBarHeight: 20,
    shopStatus: 0, // 1 营业中 0 打烊
    categories: [], // [{id, name, kind: 'dish'|'setmeal'}]
    activeCategory: null,
    items: [], // 当前分类下的菜品/套餐
    itemType: 'dish',
    itemsLoading: true,
    mainScrollTop: 0,
    refreshing: false,
    menuLoading: true,
    loadError: false,
    cartMap: {}, // key: dish_1 / setmeal_2(+flavor) → 数量，用于角标
    cartCount: 0,
    cartAmount: '0.00',
    cartList: [],
    showCart: false,
    // 口味弹窗
    flavorDish: null,
    flavorSelections: [], // 每个 flavor 选中的值
    // 套餐明细弹窗
    setmealDetail: null,
    setmealDishes: []
  },

  onLoad() {
    // 自定义导航需要自己让出状态栏高度
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.setData({ statusBarHeight: (info && info.statusBarHeight) || 20 })
    this.init()
  },

  onShow() {
    // 未登录也能浏览菜单；只有登录后才需要拉取购物车，避免一进页面就被迫授权
    if (getApp().globalData.token) {
      this.refreshCart()
    } else {
      this.resetCart()
    }
    // 首次由 onLoad 的 init 加载；之后每次回到首页/切回前台都静默刷新菜单和营业状态
    if (this._inited) {
      this.refreshMenu()
    }
    this.startStatusPolling()
  },

  onHide() {
    this.stopStatusPolling()
  },

  onUnload() {
    this.stopStatusPolling()
  },

  // 页面停留期间定时同步营业状态，避免商家打烊后仍能继续下单
  startStatusPolling() {
    this.stopStatusPolling()
    this._statusTimer = setInterval(() => {
      api.getShopStatus({ silent: true })
        .then((status) => {
          if (status !== this.data.shopStatus) {
            this.setData({ shopStatus: status })
          }
        })
        .catch(() => {})
    }, 30000)
  },

  stopStatusPolling() {
    if (this._statusTimer) {
      clearInterval(this._statusTimer)
      this._statusTimer = null
    }
  },

  async init(options = {}) {
    const silent = options.silent === true
    if (!silent) {
      this.setData({ loadError: false })
    }
    try {
      const [status, dishCats, setmealCats] = await Promise.all([
        api.getShopStatus(),
        api.getCategoryList(1),
        api.getCategoryList(2)
      ])
      const categories = [
        ...(setmealCats || []).map((c) => ({ ...c, kind: 'setmeal' })),
        ...(dishCats || []).map((c) => ({ ...c, kind: 'dish' }))
      ]
      const prev = this.data.activeCategory
      this.setData({ shopStatus: status, categories })
      // 刷新后保留用户当前选中的分类
      const target =
        categories.find((c) => prev && c.id === prev.id && c.kind === prev.kind) || categories[0] || null
      if (target) {
        // 分类未变化时静默刷新，避免列表闪白和滚动位置丢失
        const sameCategory = prev && prev.id === target.id && prev.kind === target.kind
        await this.switchCategory(target, silent && sameCategory)
      } else {
        this.setData({ activeCategory: null, items: [], itemsLoading: false, loadError: false })
      }
    } catch (e) {
      // 错误提示已在 request 内统一处理
      if (silent && this.data.categories.length) {
        // 静默刷新失败：保留现有菜单，不打断用户
        this.setData({ itemsLoading: false })
      } else {
        this.setData({ itemsLoading: false, loadError: true })
      }
    } finally {
      this._inited = true
      this.setData({ menuLoading: false })
    }
  },

  // 静默刷新菜单：onShow、回到前台、下拉刷新共用，避免并发重复请求
  refreshMenu() {
    if (this._menuRefreshing) return this._menuRefreshPromise
    this._menuRefreshing = true
    this._menuRefreshPromise = this.init({ silent: true }).finally(() => {
      this._menuRefreshing = false
      this._menuRefreshPromise = null
    })
    return this._menuRefreshPromise
  },

  retry() {
    this.setData({ itemsLoading: true, menuLoading: true })
    this.init()
  },

  onRefresh() {
    this.setData({ refreshing: true })
    this.refreshMenu().finally(() => this.setData({ refreshing: false }))
  },

  switchCategory(cat, silent = false) {
    if (silent) {
      // 静默刷新：保留当前列表和滚动位置，数据回来后再替换
      this.setData({ activeCategory: cat, itemType: cat.kind })
    } else {
      this.setData({ activeCategory: cat, items: [], itemType: cat.kind, itemsLoading: true, loadError: false })
      this.resetMainScroll()
    }
    // 竞态守卫：快速切换分类时，旧响应不得覆盖新分类的数据
    const seq = (this._loadSeq = (this._loadSeq || 0) + 1)
    const load =
      cat.kind === 'setmeal' ? api.getSetmealList(cat.id) : api.getDishList(cat.id)
    return load
      .then((list) => {
        if (seq !== this._loadSeq) return
        // 菜品口味 value 是 JSON 字符串，先解析成数组；解析失败或为空的可选维度直接丢弃
        const items = (list || []).map((item) => {
          if (item.flavors && item.flavors.length) {
            item.flavors = item.flavors
              .map((f) => {
                let value = f.value
                if (typeof value === 'string') {
                  try { value = JSON.parse(value) } catch (e) { value = [] }
                }
                return { ...f, value: value || [] }
              })
              .filter((f) => f.value.length > 0)
          }
          item._cartKey = cat.kind + '_' + item.id
          return item
        })
        this.setData({ items, itemsLoading: false, loadError: false })
      })
      .catch(() => {
        if (seq !== this._loadSeq) return
        // 静默刷新失败时保留当前列表，不把整页切换成错误态
        if (silent) {
          this.setData({ itemsLoading: false })
        } else {
          this.setData({ itemsLoading: false, loadError: true })
        }
      })
  },

  // 切换分类时右侧列表回到顶部（先改到 1 再归零，保证重复设置 0 也能触发）
  resetMainScroll() {
    this.setData({ mainScrollTop: 1 }, () => this.setData({ mainScrollTop: 0 }))
  },

  onTapCategory(e) {
    const cat = e.currentTarget.dataset.cat
    if (!cat || (this.data.activeCategory && cat.id === this.data.activeCategory.id && cat.kind === this.data.itemType)) return
    this.switchCategory(cat)
  },

  goMine() {
    wx.navigateTo({ url: '/pages/mine/mine' })
  },

  // 加购：有口味的菜品先弹规格选择
  onAdd(e) {
    const { item, kind } = e.currentTarget.dataset
    if (this.data.shopStatus !== 1) {
      wx.showToast({ title: '店铺已打烊，暂时无法下单', icon: 'none' })
      return
    }
    if (kind === 'dish' && item.flavors && item.flavors.length) {
      this.setData({
        flavorDish: item,
        flavorSelections: item.flavors.map((f) => (f.value && f.value.length ? f.value[0] : ''))
      })
      return
    }
    this.doAdd(item, kind, null)
  },

  doAdd(item, kind, flavor) {
    const data = kind === 'dish'
      ? { dishId: item.id, dishFlavor: flavor || undefined }
      : { setmealId: item.id }
    api.addCart(data).then(() => this.refreshCart()).catch(() => {})
  },

  onSub(e) {
    const { item, kind } = e.currentTarget.dataset
    const data = kind === 'dish' ? { dishId: item.id } : { setmealId: item.id }
    api.subCart(data).then(() => this.refreshCart()).catch(() => {})
  },

  // 规格弹窗选择
  onSelectFlavor(e) {
    const { index, value } = e.currentTarget.dataset
    const key = `flavorSelections[${index}]`
    this.setData({ [key]: value })
  },

  confirmFlavor() {
    const dish = this.data.flavorDish
    if (!dish) return
    // 每个口味维度都需选择一个值
    for (let i = 0; i < dish.flavors.length; i++) {
      if (!this.data.flavorSelections[i]) {
        wx.showToast({ title: `请选择${dish.flavors[i].name}`, icon: 'none' })
        return
      }
    }
    const flavor = JSON.stringify(this.data.flavorSelections)
    this.setData({ flavorDish: null })
    this.doAdd(dish, 'dish', flavor)
  },

  cancelFlavor() {
    this.setData({ flavorDish: null })
  },

  // 查看套餐明细
  onViewSetmeal(e) {
    const item = e.currentTarget.dataset.item
    api.getSetmealDishes(item.id).then((list) => {
      this.setData({ setmealDetail: item, setmealDishes: list || [] })
    }).catch(() => {})
  },

  closeSetmeal() {
    this.setData({ setmealDetail: null, setmealDishes: [] })
  },

  addSetmealFromPopup() {
    const item = this.data.setmealDetail
    this.closeSetmeal()
    this.doAdd(item, 'setmeal', null)
  },

  toggleCart() {
    if (!this.data.cartList.length) return
    this.setData({ showCart: !this.data.showCart })
  },

  onCleanCart() {
    wx.showModal({
      title: '提示',
      content: '确定清空购物车吗？',
      success: (res) => {
        if (res.confirm) {
          api.cleanCart().then(() => {
            this.setData({ showCart: false })
            this.refreshCart()
          }).catch(() => {})
        }
      }
    })
  },

  onCartAdd(e) {
    const item = e.currentTarget.dataset.item
    const data = item.dishId
      ? { dishId: item.dishId, dishFlavor: item.dishFlavor || undefined }
      : { setmealId: item.setmealId }
    api.addCart(data).then(() => this.refreshCart()).catch(() => {})
  },

  onCartSub(e) {
    const item = e.currentTarget.dataset.item
    const data = item.dishId
      ? { dishId: item.dishId, dishFlavor: item.dishFlavor || undefined }
      : { setmealId: item.setmealId }
    api.subCart(data).then(() => this.refreshCart()).catch(() => {})
  },

  refreshCart() {
    return api.getCartList().then((list) => {
      list = (list || []).map((it) => ({ ...it, flavorText: fmtFlavor(it.dishFlavor) }))
      let count = 0
      let amount = 0
      const cartMap = {}
      list.forEach((it) => {
        count += it.number
        amount += it.amount * it.number
        const kind = it.dishId ? 'dish' : 'setmeal'
        const id = it.dishId || it.setmealId
        const key = kind + '_' + id
        cartMap[key] = (cartMap[key] || 0) + it.number
      })
      this.setData({
        cartList: list,
        cartCount: count,
        cartAmount: fmtPrice(amount),
        cartMap
      })
      if (!list.length && this.data.showCart) {
        this.setData({ showCart: false })
      }
    }).catch(() => {})
  },

  resetCart() {
    if (!this.data.cartCount && !this.data.cartList.length && !this.data.showCart) return
    this.setData({ cartList: [], cartCount: 0, cartAmount: '0.00', cartMap: {}, showCart: false })
  },

  goConfirm() {
    if (!this.data.cartList.length) {
      wx.showToast({ title: '购物车是空的', icon: 'none' })
      return
    }
    if (this.data.shopStatus !== 1) {
      wx.showToast({ title: '店铺已打烊，暂时无法下单', icon: 'none' })
      return
    }
    const go = () => {
      this.setData({ showCart: false })
      wx.navigateTo({ url: '/pages/order/confirm' })
    }
    // 结算需要登录：先完成授权再进入确认页，避免确认页空数据
    if (getApp().globalData.token) {
      go()
    } else {
      getApp().ensureLogin().then(go).catch(() => {})
    }
  }
})
