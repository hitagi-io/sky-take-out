const http = require('../utils/request')

// ============ 登录 ============
// 登录走裸 wx.request，不经过 ensureLogin，避免循环依赖
function login(code) {
  const { baseUrl } = require('../utils/config')
  return new Promise((resolve, reject) => {
    wx.request({
      url: baseUrl + '/user/user/login',
      method: 'POST',
      data: { code },
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.code === 1) {
          resolve(res.data.data)
        } else {
          wx.showToast({ title: (res.data && res.data.msg) || '登录失败', icon: 'none' })
          reject(new Error('login failed'))
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常，无法登录', icon: 'none' })
        reject(new Error('network error'))
      }
    })
  })
}

// ============ 店铺 / 菜单（公开浏览，游客可访问） ============
const PUBLIC = { auth: false }
const getShopStatus = (opts) => http.get('/user/shop/status', {}, Object.assign({}, PUBLIC, opts))

// ============ 分类 / 菜品 / 套餐 ============
const getCategoryList = (type) => http.get('/user/category/list', { type }, PUBLIC)
const getDishList = (categoryId) => http.get('/user/dish/list', { categoryId }, PUBLIC)
const getSetmealList = (categoryId) => http.get('/user/setmeal/list', { categoryId }, PUBLIC)
const getSetmealDishes = (id) => http.get(`/user/setmeal/dish/${id}`, {}, PUBLIC)

// ============ 购物车 ============
const addCart = (data) => http.post('/user/shoppingCart/add', data)
const subCart = (data) => http.post('/user/shoppingCart/sub', data)
const getCartList = () => http.get('/user/shoppingCart/list')
const cleanCart = () => http.del('/user/shoppingCart/clean')

// ============ 地址簿 ============
const getAddressList = () => http.get('/user/addressBook/list')
// 没有默认地址时后端返回 code=0，属正常情况，静默处理不弹提示
const getDefaultAddress = () => http.get('/user/addressBook/default', {}, { silent: true })
const getAddressById = (id, opts) => http.get(`/user/addressBook/${id}`, {}, opts)
const addAddress = (data) => http.post('/user/addressBook', data)
const updateAddress = (data) => http.put('/user/addressBook', data)
const setDefaultAddress = (id) => http.put('/user/addressBook/default', { id })
// DELETE 请求的参数走 query（后端 deleteById(Long id) 按请求参数绑定，JSON body 不生效）
const deleteAddress = (id) => http.del(`/user/addressBook?id=${id}`)

// ============ 订单 ============
const submitOrder = (data) => http.post('/user/order/submit', data)
const payOrder = (data) => http.put('/user/order/payment', data)
const getHistoryOrders = (page, pageSize, status, opts) =>
  http.get('/user/order/historyOrders', { page, pageSize, status }, opts)
const getOrderDetail = (id, opts) => http.get(`/user/order/orderDetail/${id}`, {}, opts)
const cancelOrder = (id) => http.put(`/user/order/cancel/${id}`)
const repetitionOrder = (id) => http.post(`/user/order/repetition/${id}`)
const remindOrder = (id) => http.get(`/user/order/reminder/${id}`)

module.exports = {
  login,
  getShopStatus,
  getCategoryList,
  getDishList,
  getSetmealList,
  getSetmealDishes,
  addCart,
  subCart,
  getCartList,
  cleanCart,
  getAddressList,
  getDefaultAddress,
  getAddressById,
  addAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
  submitOrder,
  payOrder,
  getHistoryOrders,
  getOrderDetail,
  cancelOrder,
  repetitionOrder,
  remindOrder
}
