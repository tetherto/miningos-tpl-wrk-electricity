'use strict'

const TetherWrkBase = require('tether-wrk-base/workers/base.wrk.tether')
const async = require('async')
const mingo = require('mingo')

class WrkElectricityRack extends TetherWrkBase {
  constructor (conf, ctx) {
    super(conf, ctx)
    if (!ctx.rack) {
      throw new Error('ERR_PROC_RACK_UNDEFINED')
    }

    this.prefix = `${this.wtype}-${ctx.rack}`
    this.init()
    this.start()
  }

  init () {
    super.init()

    this.cache = {
      futureLogs: {},
      spotPriceForecast: [],
      nextHourEnergyCost: 0,
      hashpricePerHour: 0,
      nextHourRevenue: 0,
      nextHourShouldMine: false,
      hashrate: 0,
      consumption: 0,
      btcFees: 0,
      btcFeesChange: 0
    }

    this.setInitFacs([
      ['fac', 'bfx-facs-scheduler', '0', 'f2', {}, -10],
      [
        'fac',
        'hp-svc-facs-store',
        's1',
        's1',
        {
          storePrimaryKey: this.ctx.storePrimaryKey,
          storeDir: `store/${this.ctx.rack}-db`
        },
        0
      ]
    ])
  }

  _start (cb) {
    async.series(
      [
        (next) => {
          super._start(next)
        },
        async () => {
          const db = await this.store_s1.getBee(
            { name: 'electricity' },
            { keyEncoding: 'binary' }
          )
          await db.ready()
          this.settings = db.sub('settings')
          this.net_r0.rpcServer.respond('getWrkExtData', async (req) => {
            return await this.net_r0.handleReply('getWrkExtData', req)
          })
        }
      ],
      cb
    )
  }

  _projection (data, fields = {}) {
    const query = new mingo.Query({})
    const cursor = query.find(data, fields)
    return cursor.all()
  }

  async getMargin (req) {
    const wrkSettings = await this.getWrkSettings()
    return wrkSettings.margin || 0
  }

  async getRevenueEstimates (req) {
    // no-op
  }

  async getSpotPrice (req) {
    // no-op
  }

  async getStats (req) {
    // no-op
  }

  async getCostRevenue (req) {
    // no-op
  }

  async getStatsHistory (req) {
    // no-op
  }

  async getWrkExtData (req) {
    const { query } = req
    if (!query) throw new Error('ERR_QUERY_INVALID')
    const { key } = query
    if (!key) throw new Error('ERR_KEY_INVALID')

    let data
    switch (key) {
      case 'margin':
        data = await this.getMargin(query)
        break
      case 'revenue-estimates':
        data = await this.getRevenueEstimates(query)
        break
      case 'spot-price':
        data = await this.getSpotPrice(query)
        break
      case 'stats':
        data = await this.getStats(query)
        break
      case 'cost-revenue':
        data = await this.getCostRevenue(query)
        break
      case 'stats-history':
        data = await this.getStatsHistory(query)
        break
      default:
        data = this.data[key]
        break
    }
    return data
  }
}

module.exports = WrkElectricityRack
