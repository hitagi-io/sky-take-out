// 金额格式化：分/元统一两位小数字符串
function fmtPrice(n) {
  const num = Number(n || 0)
  return num.toFixed(2)
}

// 日期格式化为后端 LocalDateTime 需要的 "yyyy-MM-dd HH:mm:ss"
function fmtDateTime(date) {
  const d = date || new Date()
  const p = (n) => (n < 10 ? '0' + n : '' + n)
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

// 订单状态映射（与后端 Orders 常量一致）
const ORDER_STATUS = {
  1: '待付款',
  2: '待接单',
  3: '已接单',
  4: '派送中',
  5: '已完成',
  6: '已取消'
}

function orderStatusText(status) {
  return ORDER_STATUS[status] || '未知'
}

// 口味在库中存的是 JSON 数组字符串（如 ["微辣","大份"]），展示时转成「微辣 / 大份」
function fmtFlavor(flavor) {
  if (!flavor) return ''
  try {
    const arr = JSON.parse(flavor)
    if (Array.isArray(arr)) {
      return arr.filter(Boolean).join(' / ')
    }
  } catch (e) {
    // 非 JSON 的历史数据直接原样展示
  }
  return flavor
}

module.exports = { fmtPrice, fmtDateTime, ORDER_STATUS, orderStatusText, fmtFlavor }
