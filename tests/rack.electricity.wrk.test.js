'use strict'

const test = require('brittle')
const path = require('path')

const baseModulePath = require.resolve('@tetherto/tether-wrk-base/workers/base.wrk.tether')
const workerModulePath = path.resolve(__dirname, '../workers/rack.electricity.wrk.js')

class MockBase {
  constructor (conf, ctx) {
    this.conf = conf
    this.ctx = ctx
    this.wtype = 'wrk'
    this.data = {}
    this.net_r0 = { rpcServer: { respond: () => {} }, handleReply: async () => null }
  }

  init () {}

  start () {}

  setInitFacs (facs) {
    this._initFacs = facs
  }

  _start (cb) {
    cb()
  }
}

const loadWorker = () => {
  require.cache[baseModulePath] = {
    id: baseModulePath,
    filename: baseModulePath,
    loaded: true,
    exports: MockBase
  }
  delete require.cache[workerModulePath]
  return require(workerModulePath)
}

test('WrkElectricityRack: constructor validates rack and initializes', (t) => {
  const WrkElectricityRack = loadWorker()

  t.exception(() => new WrkElectricityRack({}, {}), /ERR_PROC_RACK_UNDEFINED/)

  const instance = new WrkElectricityRack({}, { rack: 'rack-a', storePrimaryKey: 'pk' })
  t.is(instance.prefix, 'wrk-rack-a')
  t.alike(instance.cache, {
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
  })
  t.is(instance._initFacs[1][4].storePrimaryKey, 'pk')
  t.is(instance._initFacs[1][4].storeDir, 'store/rack-a-db')
})

test('WrkElectricityRack: _start wires settings db and rpc handler', async (t) => {
  const WrkElectricityRack = loadWorker()
  const instance = new WrkElectricityRack({}, { rack: 'rack-a' })

  let readyCalled = false
  const subResult = { ns: 'settings' }
  instance.store_s1 = {
    getBee: async (opts, enc) => {
      t.alike(opts, { name: 'electricity' })
      t.alike(enc, { keyEncoding: 'binary' })
      return {
        ready: async () => { readyCalled = true },
        sub: (name) => {
          t.is(name, 'settings')
          return subResult
        }
      }
    }
  }

  let registeredName = null
  let registeredHandler = null
  instance.net_r0 = {
    rpcServer: {
      respond: (name, handler) => {
        registeredName = name
        registeredHandler = handler
      }
    },
    handleReply: async (name, req) => ({ name, req, ok: true })
  }

  await new Promise((resolve, reject) => {
    instance._start((err) => {
      if (err) return reject(err)
      resolve()
    })
  })

  t.ok(readyCalled)
  t.is(instance.settings, subResult)
  t.is(registeredName, 'getWrkExtData')
  const rpcResp = await registeredHandler({ query: { key: 'margin' } })
  t.alike(rpcResp, { name: 'getWrkExtData', req: { query: { key: 'margin' } }, ok: true })
})

test('WrkElectricityRack: _projection and getMargin', async (t) => {
  const WrkElectricityRack = loadWorker()
  const instance = new WrkElectricityRack({}, { rack: 'rack-a' })

  const projected = instance._projection(
    [{ id: 1, name: 'n1', value: 10 }, { id: 2, name: 'n2', value: 20 }],
    { name: 1 }
  )

  t.alike(projected, [{ name: 'n1' }, { name: 'n2' }])

  instance.getWrkSettings = async () => ({ margin: 25 })
  t.is(await instance.getMargin({}), 25)
  instance.getWrkSettings = async () => ({})
  t.is(await instance.getMargin({}), 0)
})

test('WrkElectricityRack: getWrkExtData validates req and resolves all keys', async (t) => {
  const WrkElectricityRack = loadWorker()
  const instance = new WrkElectricityRack({}, { rack: 'rack-a' })

  await t.exception(instance.getWrkExtData({}), /ERR_QUERY_INVALID/)
  await t.exception(instance.getWrkExtData({ query: {} }), /ERR_KEY_INVALID/)

  instance.getMargin = async () => 1
  instance.getRevenueEstimates = async () => 2
  instance.getSpotPrice = async () => 3
  instance.getStats = async () => 4
  instance.getCostRevenue = async () => 5
  instance.getStatsHistory = async () => 6
  instance.data.custom = 7

  t.is(await instance.getWrkExtData({ query: { key: 'margin' } }), 1)
  t.is(await instance.getWrkExtData({ query: { key: 'revenue-estimates' } }), 2)
  t.is(await instance.getWrkExtData({ query: { key: 'spot-price' } }), 3)
  t.is(await instance.getWrkExtData({ query: { key: 'stats' } }), 4)
  t.is(await instance.getWrkExtData({ query: { key: 'cost-revenue' } }), 5)
  t.is(await instance.getWrkExtData({ query: { key: 'stats-history' } }), 6)
  t.is(await instance.getWrkExtData({ query: { key: 'custom' } }), 7)
})

test('WrkElectricityRack: no-op data methods return undefined', async (t) => {
  const WrkElectricityRack = loadWorker()
  const instance = new WrkElectricityRack({}, { rack: 'rack-a' })

  t.absent(await instance.getRevenueEstimates({}))
  t.absent(await instance.getSpotPrice({}))
  t.absent(await instance.getStats({}))
  t.absent(await instance.getCostRevenue({}))
  t.absent(await instance.getStatsHistory({}))
})
