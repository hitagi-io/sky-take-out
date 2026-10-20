const api = require('../../api/index')

const LABELS = ['家', '公司', '学校']

Page({
  data: {
    id: null,
    consignee: '',
    phone: '',
    sex: '1',
    region: [], // [省, 市, 区]
    regionCode: [],
    detail: '',
    label: '家',
    labels: LABELS,
    isDefault: false,
    saving: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ id: Number(options.id) })
      wx.setNavigationBarTitle({ title: '编辑地址' })
      api.getAddressById(options.id)
        .then((addr) => {
          this.setData({
            consignee: addr.consignee,
            phone: addr.phone,
            sex: addr.sex || '1',
            region: [addr.provinceName, addr.cityName, addr.districtName],
            regionCode: [addr.provinceCode, addr.cityCode, addr.districtCode],
            detail: addr.detail,
            label: addr.label || '家',
            isDefault: addr.isDefault === 1
          })
        })
        .catch(() => {})
    } else {
      wx.setNavigationBarTitle({ title: '新增地址' })
    }
  },

  onInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value })
  },

  onSex(e) {
    this.setData({ sex: e.currentTarget.dataset.value })
  },

  onRegion(e) {
    // mode=region 返回 [省, 市, 区] 及对应 code
    this.setData({ region: e.detail.value, regionCode: e.detail.code || [] })
  },

  onLabel(e) {
    this.setData({ label: e.currentTarget.dataset.value })
  },

  onDefault(e) {
    this.setData({ isDefault: e.detail.value })
  },

  onSave() {
    if (this.data.saving) return
    const { consignee, phone, region, detail, label, isDefault, sex, id } = this.data
    if (!consignee.trim()) {
      wx.showToast({ title: '请填写收货人姓名', icon: 'none' })
      return
    }
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请填写正确的手机号', icon: 'none' })
      return
    }
    if (!region.length) {
      wx.showToast({ title: '请选择所在地区', icon: 'none' })
      return
    }
    if (!detail.trim()) {
      wx.showToast({ title: '请填写详细地址', icon: 'none' })
      return
    }
    const data = {
      id: id || undefined,
      consignee: consignee.trim(),
      phone,
      sex,
      provinceCode: this.data.regionCode[0] || '',
      provinceName: region[0],
      cityCode: this.data.regionCode[1] || '',
      cityName: region[1],
      districtCode: this.data.regionCode[2] || '',
      districtName: region[2],
      detail: detail.trim(),
      label,
      isDefault: isDefault ? 1 : 0
    }
    this.setData({ saving: true })
    const save = id ? api.updateAddress(data) : api.addAddress(data)
    save
      .then(() => {
        if (data.isDefault !== 1) return
        // 后端新增地址强制 isDefault=0；而更新地址会直接写入 isDefault=1 但不清除旧默认地址，
        // 两种情况都需要补调一次“设为默认”让后端归一化，保证只有一个默认地址
        if (id) {
          return api.setDefaultAddress(id)
        }
        return api.getAddressList().then((list) => {
          const target = (list || []).find(
            (a) => a.phone === data.phone && a.detail === data.detail && a.consignee === data.consignee
          )
          if (target) return api.setDefaultAddress(target.id)
        })
      })
      .then(() => {
        wx.showToast({ title: '已保存', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 600)
      })
      .catch(() => {})
      .finally(() => this.setData({ saving: false }))
  }
})
