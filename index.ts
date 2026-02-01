/**
 * Alpaca Trading Plugin
 * Trade stocks, crypto, and options via Alpaca's Trading API v2.
 * Supports both paper and live trading modes.
 */

import type { PluginContext, PluginRegistrations } from "./types"
import { Elysia } from "elysia"

// ── Alpaca API URLs ─────────────────────────────────────────

const PAPER_TRADE_URL = "https://paper-api.alpaca.markets"
const LIVE_TRADE_URL = "https://api.alpaca.markets"
const DATA_URL = "https://data.alpaca.markets"

// ── Types ───────────────────────────────────────────────────

interface AlpacaAccount {
  id: string
  account_number: string
  status: string
  currency: string
  buying_power: string
  cash: string
  portfolio_value: string
  equity: string
  last_equity: string
  long_market_value: string
  short_market_value: string
  initial_margin: string
  maintenance_margin: string
  daytrade_count: number
  daytrading_buying_power: string
  pattern_day_trader: boolean
}

interface AlpacaPosition {
  asset_id: string
  symbol: string
  exchange: string
  asset_class: string
  avg_entry_price: string
  qty: string
  side: string
  market_value: string
  cost_basis: string
  unrealized_pl: string
  unrealized_plpc: string
  current_price: string
  lastday_price: string
  change_today: string
}

interface AlpacaOrder {
  id: string
  client_order_id: string
  created_at: string
  updated_at: string
  submitted_at: string
  filled_at: string | null
  expired_at: string | null
  canceled_at: string | null
  failed_at: string | null
  asset_id: string
  symbol: string
  asset_class: string
  qty: string
  filled_qty: string
  filled_avg_price: string | null
  order_class: string
  order_type: string
  type: string
  side: string
  time_in_force: string
  limit_price: string | null
  stop_price: string | null
  status: string
  extended_hours: boolean
  trail_percent: string | null
  trail_price: string | null
}

interface AlpacaClock {
  timestamp: string
  is_open: boolean
  next_open: string
  next_close: string
}

interface AlpacaBar {
  t: string
  o: number
  h: number
  l: number
  c: number
  v: number
  n: number
  vw: number
}

interface AlpacaSnapshot {
  latestTrade: { t: string; p: number; s: number }
  latestQuote: { t: string; bp: number; bs: number; ap: number; as: number }
  minuteBar: AlpacaBar
  dailyBar: AlpacaBar
  prevDailyBar: AlpacaBar
}

// ── Helpers ─────────────────────────────────────────────────

function formatMoney(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) : val
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPercent(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) : val
  const sign = n >= 0 ? "+" : ""
  return `${sign}${(n * 100).toFixed(2)}%`
}

function ok(text: string) {
  return { content: [{ type: "text" as const, text }], isError: false }
}

function err(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true }
}

// ── API Client ──────────────────────────────────────────────

class AlpacaClient {
  private apiKey: string
  private secretKey: string
  private tradeUrl: string
  private dataUrl: string

  constructor(apiKey: string, secretKey: string, paper: boolean) {
    this.apiKey = apiKey
    this.secretKey = secretKey
    this.tradeUrl = paper ? PAPER_TRADE_URL : LIVE_TRADE_URL
    this.dataUrl = DATA_URL
  }

  private headers(): Record<string, string> {
    return {
      "APCA-API-KEY-ID": this.apiKey,
      "APCA-API-SECRET-KEY": this.secretKey,
      "Content-Type": "application/json",
    }
  }

  async trade<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.tradeUrl}${path}`
    const opts: RequestInit = { method, headers: this.headers() }
    if (body) opts.body = JSON.stringify(body)

    const res = await fetch(url, opts)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Alpaca ${res.status}: ${text}`)
    }
    if (res.status === 204) return {} as T
    return (await res.json()) as T
  }

  async data<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.dataUrl}${path}`)
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v)
    }

    const res = await fetch(url.toString(), { headers: this.headers() })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Alpaca Data ${res.status}: ${text}`)
    }
    return (await res.json()) as T
  }

  // ── Account ──
  getAccount() { return this.trade<AlpacaAccount>("GET", "/v2/account") }

  // ── Positions ──
  getPositions() { return this.trade<AlpacaPosition[]>("GET", "/v2/positions") }
  getPosition(symbol: string) { return this.trade<AlpacaPosition>("GET", `/v2/positions/${encodeURIComponent(symbol)}`) }
  closePosition(symbol: string, qty?: string, percentage?: string) {
    const params = new URLSearchParams()
    if (qty) params.set("qty", qty)
    if (percentage) params.set("percentage", percentage)
    const qs = params.toString() ? `?${params}` : ""
    return this.trade<AlpacaOrder>("DELETE", `/v2/positions/${encodeURIComponent(symbol)}${qs}`)
  }
  closeAllPositions(cancelOrders = true) {
    return this.trade<unknown>("DELETE", `/v2/positions?cancel_orders=${cancelOrders}`)
  }

  // ── Orders ──
  getOrders(status = "open", limit = 50) {
    return this.trade<AlpacaOrder[]>("GET", `/v2/orders?status=${status}&limit=${limit}`)
  }
  getOrder(orderId: string) { return this.trade<AlpacaOrder>("GET", `/v2/orders/${orderId}`) }
  placeOrder(order: Record<string, unknown>) { return this.trade<AlpacaOrder>("POST", "/v2/orders", order) }
  cancelOrder(orderId: string) { return this.trade<void>("DELETE", `/v2/orders/${orderId}`) }
  cancelAllOrders() { return this.trade<unknown>("DELETE", "/v2/orders") }

  // ── Clock / Calendar ──
  getClock() { return this.trade<AlpacaClock>("GET", "/v2/clock") }
  getCalendar(start?: string, end?: string) {
    const params = new URLSearchParams()
    if (start) params.set("start", start)
    if (end) params.set("end", end)
    const qs = params.toString() ? `?${params}` : ""
    return this.trade<Array<{ date: string; open: string; close: string }>>("GET", `/v2/calendar${qs}`)
  }

  // ── Portfolio History ──
  getPortfolioHistory(period = "1M", timeframe = "1D") {
    return this.trade<{
      timestamp: number[]
      equity: number[]
      profit_loss: number[]
      profit_loss_pct: number[]
      base_value: number
      timeframe: string
    }>("GET", `/v2/account/portfolio/history?period=${period}&timeframe=${timeframe}`)
  }

  // ── Market Data ──
  getSnapshot(symbol: string) {
    return this.data<AlpacaSnapshot>(`/v2/stocks/${encodeURIComponent(symbol)}/snapshot`, { feed: "iex" })
  }
  getSnapshots(symbols: string[]) {
    return this.data<Record<string, AlpacaSnapshot>>(`/v2/stocks/snapshots`, { symbols: symbols.join(","), feed: "iex" })
  }
  getBars(symbol: string, timeframe: string, start: string, end?: string, limit = "100") {
    const params: Record<string, string> = { timeframe, start, limit, feed: "iex", sort: "desc" }
    if (end) params.end = end
    return this.data<{ bars: AlpacaBar[] }>(`/v2/stocks/${encodeURIComponent(symbol)}/bars`, params)
  }

  // ── Crypto ──
  getCryptoSnapshot(symbol: string) {
    return this.data<{
      latestTrade: { t: string; p: number; s: number }
      latestQuote: { t: string; bp: number; bs: number; ap: number; as: number }
      minuteBar: AlpacaBar
      dailyBar: AlpacaBar
    }>(`/v1beta3/crypto/us/snapshots/${encodeURIComponent(symbol)}`)
  }

  // ── Watchlists ──
  getWatchlists() { return this.trade<Array<{ id: string; name: string; account_id: string }>>("GET", "/v2/watchlists") }
  createWatchlist(name: string, symbols: string[]) { return this.trade<unknown>("POST", "/v2/watchlists", { name, symbols }) }
  getWatchlist(id: string) {
    return this.trade<{ id: string; name: string; assets: Array<{ id: string; symbol: string; name: string }> }>("GET", `/v2/watchlists/${id}`)
  }
  addToWatchlist(id: string, symbol: string) { return this.trade<unknown>("POST", `/v2/watchlists/${id}`, { symbol }) }
  deleteWatchlist(id: string) { return this.trade<void>("DELETE", `/v2/watchlists/${id}`) }
}

// ── Plugin Entry ────────────────────────────────────────────

export async function activate(ctx: PluginContext): Promise<PluginRegistrations> {
  ctx.log.info("Activating alpaca-trading plugin")

  function getClient(): AlpacaClient {
    const apiKey = ctx.getSetting<string>("alpacaApiKey")
    const secretKey = ctx.getSetting<string>("alpacaSecretKey")
    if (!apiKey || !secretKey) throw new Error("Alpaca API credentials not configured. Set them in plugin settings.")
    const mode = ctx.getSetting<string>("tradingMode") || "paper"
    return new AlpacaClient(apiKey, secretKey, mode === "paper")
  }

  function modeLabel(): string {
    const mode = ctx.getSetting<string>("tradingMode") || "paper"
    return mode === "paper" ? "PAPER" : "LIVE"
  }

  return {
    routes: () =>
      new Elysia()
        .get("/account", async () => {
          try { return await getClient().getAccount() }
          catch (e) { return { error: e instanceof Error ? e.message : String(e) } }
        })
        .get("/positions", async () => {
          try { return await getClient().getPositions() }
          catch (e) { return { error: e instanceof Error ? e.message : String(e) } }
        })
        .get("/orders", async () => {
          try { return await getClient().getOrders() }
          catch (e) { return { error: e instanceof Error ? e.message : String(e) } }
        })
        .get("/clock", async () => {
          try { return await getClient().getClock() }
          catch (e) { return { error: e instanceof Error ? e.message : String(e) } }
        }),

    tools: [
      // ══════════════════════════════════════════════════════
      //  ACCOUNT & PORTFOLIO
      // ══════════════════════════════════════════════════════

      {
        definition: {
          name: "alpaca_account",
          description: "Get Alpaca trading account info: buying power, equity, cash, margin, P&L, and day trade count. Shows whether you're in paper or live mode.",
          inputSchema: { type: "object" as const, properties: {}, required: [] },
        },
        handler: async () => {
          try {
            const client = getClient()
            const acct = await client.getAccount()
            const lines = [
              `Alpaca Account [${modeLabel()}]`,
              `Status: ${acct.status}`,
              ``,
              `Equity: $${formatMoney(acct.equity)}`,
              `Cash: $${formatMoney(acct.cash)}`,
              `Buying Power: $${formatMoney(acct.buying_power)}`,
              `Portfolio Value: $${formatMoney(acct.portfolio_value)}`,
              ``,
              `Long Market Value: $${formatMoney(acct.long_market_value)}`,
              `Short Market Value: $${formatMoney(acct.short_market_value)}`,
              ``,
              `Day Trades (last 5 days): ${acct.daytrade_count}`,
              `Pattern Day Trader: ${acct.pattern_day_trader ? "Yes" : "No"}`,
              `DT Buying Power: $${formatMoney(acct.daytrading_buying_power)}`,
            ]
            return ok(lines.join("\n"))
          } catch (e) { return err(e instanceof Error ? e.message : String(e)) }
        },
      },

      {
        definition: {
          name: "alpaca_positions",
          description: "List all open positions in the Alpaca account. Shows symbol, qty, avg entry, current price, market value, and unrealized P&L.",
          inputSchema: { type: "object" as const, properties: {}, required: [] },
        },
        handler: async () => {
          try {
            const positions = await getClient().getPositions()
            if (positions.length === 0) return ok(`No open positions [${modeLabel()}]`)

            const lines = [`Open Positions [${modeLabel()}] (${positions.length})`, ``]
            for (const p of positions) {
              const plSign = parseFloat(p.unrealized_pl) >= 0 ? "+" : ""
              lines.push(
                `${p.symbol} — ${p.qty} shares @ $${formatMoney(p.avg_entry_price)}`,
                `  Current: $${formatMoney(p.current_price)} | Value: $${formatMoney(p.market_value)}`,
                `  P&L: ${plSign}$${formatMoney(p.unrealized_pl)} (${formatPercent(p.unrealized_plpc)})`,
                ``
              )
            }
            return ok(lines.join("\n"))
          } catch (e) { return err(e instanceof Error ? e.message : String(e)) }
        },
      },

      {
        definition: {
          name: "alpaca_portfolio_history",
          description: "Get portfolio equity and P&L history over time. Useful for performance analysis and charting.",
          inputSchema: {
            type: "object" as const,
            properties: {
              period: { type: "string", description: "History period: 1D, 1W, 1M, 3M, 6M, 1A (1 year), all", enum: ["1D", "1W", "1M", "3M", "6M", "1A", "all"] },
              timeframe: { type: "string", description: "Bar resolution: 1Min, 5Min, 15Min, 1H, 1D", enum: ["1Min", "5Min", "15Min", "1H", "1D"] },
            },
          },
        },
        handler: async (args) => {
          try {
            const period = (args.period as string) || "1M"
            const timeframe = (args.timeframe as string) || "1D"
            const hist = await getClient().getPortfolioHistory(period, timeframe)

            if (!hist.timestamp || hist.timestamp.length === 0) {
              return ok("No portfolio history available.")
            }

            const count = hist.timestamp.length
            const latest = hist.equity[count - 1]
            const earliest = hist.equity[0]
            const totalReturn = ((latest - earliest) / earliest) * 100
            const totalPL = hist.profit_loss.reduce((a, b) => a + b, 0)

            const lines = [
              `Portfolio History [${modeLabel()}] — ${period} @ ${timeframe}`,
              `Base Value: $${formatMoney(hist.base_value)}`,
              `Current Equity: $${formatMoney(latest)}`,
              `Period Return: ${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%`,
              `Total P&L: ${totalPL >= 0 ? "+" : ""}$${formatMoney(totalPL)}`,
              ``,
              `Last 5 data points:`,
            ]

            const tail = Math.min(5, count)
            for (let i = count - tail; i < count; i++) {
              const date = new Date(hist.timestamp[i] * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              const pl = hist.profit_loss[i]
              lines.push(`  ${date}: $${formatMoney(hist.equity[i])} (${pl >= 0 ? "+" : ""}$${formatMoney(pl)})`)
            }

            return ok(lines.join("\n"))
          } catch (e) { return err(e instanceof Error ? e.message : String(e)) }
        },
      },

      // ══════════════════════════════════════════════════════
      //  MARKET DATA
      // ══════════════════════════════════════════════════════

      {
        definition: {
          name: "alpaca_quote",
          description: "Get a real-time stock snapshot: last trade, bid/ask, daily bar, and previous close. Uses Alpaca market data.",
          inputSchema: {
            type: "object" as const,
            properties: {
              symbol: { type: "string", description: "Ticker symbol (e.g. AAPL, TSLA, SPY)" },
            },
            required: ["symbol"],
          },
        },
        handler: async (args) => {
          try {
            const symbol = (args.symbol as string).toUpperCase()
            const snap = await getClient().getSnapshot(symbol)

            const price = snap.latestTrade.p
            const prevClose = snap.prevDailyBar.c
            const change = price - prevClose
            const changePct = (change / prevClose) * 100
            const sign = change >= 0 ? "+" : ""

            const lines = [
              `${symbol}: $${formatMoney(price)}`,
              `Change: ${sign}$${formatMoney(change)} (${sign}${changePct.toFixed(2)}%)`,
              `Bid: $${formatMoney(snap.latestQuote.bp)} x ${snap.latestQuote.bs} | Ask: $${formatMoney(snap.latestQuote.ap)} x ${snap.latestQuote.as}`,
              `Today: O $${formatMoney(snap.dailyBar.o)} H $${formatMoney(snap.dailyBar.h)} L $${formatMoney(snap.dailyBar.l)} V ${snap.dailyBar.v.toLocaleString()}`,
              `Prev Close: $${formatMoney(prevClose)}`,
            ]
            return ok(lines.join("\n"))
          } catch (e) { return err(e instanceof Error ? e.message : String(e)) }
        },
      },

      {
        definition: {
          name: "alpaca_quotes",
          description: "Get real-time snapshots for multiple stock symbols at once.",
          inputSchema: {
            type: "object" as const,
            properties: {
              symbols: { type: "array", items: { type: "string" }, description: "Array of ticker symbols" },
            },
            required: ["symbols"],
          },
        },
        handler: async (args) => {
          try {
            const symbols = (args.symbols as string[]).map(s => s.toUpperCase())
            const snaps = await getClient().getSnapshots(symbols)

            const lines: string[] = []
            for (const sym of symbols) {
              const snap = snaps[sym]
              if (!snap) { lines.push(`${sym}: No data`); continue }
              const price = snap.latestTrade.p
              const prevClose = snap.prevDailyBar.c
              const change = price - prevClose
              const pct = (change / prevClose) * 100
              const sign = change >= 0 ? "+" : ""
              lines.push(`${sym}: $${formatMoney(price)} (${sign}${pct.toFixed(2)}%)`)
            }
            return ok(lines.join("\n"))
          } catch (e) { return err(e instanceof Error ? e.message : String(e)) }
        },
      },

      {
        definition: {
          name: "alpaca_bars",
          description: "Get historical OHLCV bars for a stock. Useful for trend analysis and charting.",
          inputSchema: {
            type: "object" as const,
            properties: {
              symbol: { type: "string", description: "Ticker symbol" },
              timeframe: { type: "string", description: "Bar size: 1Min, 5Min, 15Min, 1Hour, 1Day, 1Week, 1Month", enum: ["1Min", "5Min", "15Min", "1Hour", "1Day", "1Week", "1Month"] },
              days: { type: "number", description: "Number of days of history (default: 30)" },
              limit: { type: "number", description: "Max bars to return (default: 50, max: 200)" },
            },
            required: ["symbol"],
          },
        },
        handler: async (args) => {
          try {
            const symbol = (args.symbol as string).toUpperCase()
            const timeframe = (args.timeframe as string) || "1Day"
            const days = Math.min((args.days as number) || 30, 365)
            const limit = String(Math.min((args.limit as number) || 50, 200))

            const start = new Date(Date.now() - days * 86400000).toISOString().split("T")[0]
            const result = await getClient().getBars(symbol, timeframe, start, undefined, limit)

            if (!result.bars || result.bars.length === 0) {
              return err(`No bar data for ${symbol}`)
            }

            const bars = result.bars
            const latest = bars[0]
            const earliest = bars[bars.length - 1]
            const periodReturn = ((latest.c - earliest.c) / earliest.c) * 100

            const lines = [
              `${symbol} — ${bars.length} bars (${timeframe}, ${days}d)`,
              `Latest: $${formatMoney(latest.c)} | Period Return: ${periodReturn >= 0 ? "+" : ""}${periodReturn.toFixed(2)}%`,
              `Period High: $${formatMoney(Math.max(...bars.map(b => b.h)))}`,
              `Period Low: $${formatMoney(Math.min(...bars.map(b => b.l)))}`,
              ``,
              `Recent bars:`,
            ]

            for (const bar of bars.slice(0, 8)) {
              const date = new Date(bar.t).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              lines.push(`  ${date}: O $${formatMoney(bar.o)} H $${formatMoney(bar.h)} L $${formatMoney(bar.l)} C $${formatMoney(bar.c)} V ${bar.v.toLocaleString()}`)
            }

            return ok(lines.join("\n"))
          } catch (e) { return err(e instanceof Error ? e.message : String(e)) }
        },
      },

      {
        definition: {
          name: "alpaca_crypto_quote",
          description: "Get a real-time crypto snapshot from Alpaca. Supports symbols like BTC/USD, ETH/USD.",
          inputSchema: {
            type: "object" as const,
            properties: {
              symbol: { type: "string", description: "Crypto pair (e.g. BTC/USD, ETH/USD, SOL/USD)" },
            },
            required: ["symbol"],
          },
        },
        handler: async (args) => {
          try {
            const symbol = (args.symbol as string).toUpperCase()
            const snap = await getClient().getCryptoSnapshot(symbol)

            const price = snap.latestTrade.p
            const lines = [
              `${symbol}: $${formatMoney(price)}`,
              `Bid: $${formatMoney(snap.latestQuote.bp)} | Ask: $${formatMoney(snap.latestQuote.ap)}`,
              `Daily: O $${formatMoney(snap.dailyBar.o)} H $${formatMoney(snap.dailyBar.h)} L $${formatMoney(snap.dailyBar.l)} V ${snap.dailyBar.v.toLocaleString()}`,
            ]
            return ok(lines.join("\n"))
          } catch (e) { return err(e instanceof Error ? e.message : String(e)) }
        },
      },

      // ══════════════════════════════════════════════════════
      //  ORDER EXECUTION
      // ══════════════════════════════════════════════════════

      {
        definition: {
          name: "alpaca_place_order",
          description: "Place a stock or ETF order. Supports market, limit, stop, stop-limit, and trailing-stop orders. IMPORTANT: Confirm the trading mode (paper/live) with the user before placing orders.",
          inputSchema: {
            type: "object" as const,
            properties: {
              symbol: { type: "string", description: "Ticker symbol (e.g. AAPL)" },
              side: { type: "string", description: "buy or sell", enum: ["buy", "sell"] },
              qty: { type: "number", description: "Number of shares (whole or fractional)" },
              order_type: { type: "string", description: "Order type", enum: ["market", "limit", "stop", "stop_limit", "trailing_stop"] },
              limit_price: { type: "number", description: "Limit price (required for limit and stop_limit)" },
              stop_price: { type: "number", description: "Stop price (required for stop and stop_limit)" },
              trail_percent: { type: "number", description: "Trailing stop percent (for trailing_stop)" },
              trail_price: { type: "number", description: "Trailing stop dollar amount (for trailing_stop)" },
              time_in_force: { type: "string", description: "Time in force", enum: ["day", "gtc", "opg", "cls", "ioc", "fok"] },
              extended_hours: { type: "boolean", description: "Allow extended hours trading (limit orders only)" },
            },
            required: ["symbol", "side", "qty"],
          },
        },
        handler: async (args) => {
          try {
            const order: Record<string, unknown> = {
              symbol: (args.symbol as string).toUpperCase(),
              side: args.side || "buy",
              qty: String(args.qty),
              type: args.order_type || "market",
              time_in_force: args.time_in_force || "day",
            }
            if (args.limit_price) order.limit_price = String(args.limit_price)
            if (args.stop_price) order.stop_price = String(args.stop_price)
            if (args.trail_percent) order.trail_percent = String(args.trail_percent)
            if (args.trail_price) order.trail_price = String(args.trail_price)
            if (args.extended_hours) order.extended_hours = true

            const result = await getClient().placeOrder(order)

            const lines = [
              `Order Placed [${modeLabel()}]`,
              `${result.side.toUpperCase()} ${result.qty} ${result.symbol}`,
              `Type: ${result.order_type} | TIF: ${result.time_in_force}`,
              result.limit_price ? `Limit: $${formatMoney(result.limit_price)}` : null,
              result.stop_price ? `Stop: $${formatMoney(result.stop_price)}` : null,
              `Status: ${result.status}`,
              `Order ID: ${result.id}`,
            ].filter(Boolean)

            return ok(lines.join("\n"))
          } catch (e) { return err(e instanceof Error ? e.message : String(e)) }
        },
      },

      {
        definition: {
          name: "alpaca_place_crypto_order",
          description: "Place a crypto order. Supports market and limit orders with qty or notional (dollar) amounts.",
          inputSchema: {
            type: "object" as const,
            properties: {
              symbol: { type: "string", description: "Crypto pair (e.g. BTC/USD, ETH/USD)" },
              side: { type: "string", description: "buy or sell", enum: ["buy", "sell"] },
              qty: { type: "number", description: "Quantity of crypto (e.g. 0.5 for half a BTC)" },
              notional: { type: "number", description: "Dollar amount instead of qty (e.g. 100 for $100 worth)" },
              order_type: { type: "string", description: "Order type", enum: ["market", "limit", "stop_limit"] },
              limit_price: { type: "number", description: "Limit price" },
              time_in_force: { type: "string", description: "Time in force for crypto", enum: ["gtc", "ioc"] },
            },
            required: ["symbol", "side"],
          },
        },
        handler: async (args) => {
          try {
            const order: Record<string, unknown> = {
              symbol: (args.symbol as string).toUpperCase(),
              side: args.side,
              type: args.order_type || "market",
              time_in_force: args.time_in_force || "gtc",
            }
            if (args.qty) order.qty = String(args.qty)
            else if (args.notional) order.notional = String(args.notional)
            else return err("Either qty or notional is required.")

            if (args.limit_price) order.limit_price = String(args.limit_price)

            const result = await getClient().placeOrder(order)

            const lines = [
              `Crypto Order Placed [${modeLabel()}]`,
              `${result.side.toUpperCase()} ${result.qty || "$" + formatMoney(args.notional as number)} ${result.symbol}`,
              `Type: ${result.order_type} | TIF: ${result.time_in_force}`,
              `Status: ${result.status}`,
              `Order ID: ${result.id}`,
            ]
            return ok(lines.join("\n"))
          } catch (e) { return err(e instanceof Error ? e.message : String(e)) }
        },
      },

      {
        definition: {
          name: "alpaca_orders",
          description: "List recent orders. Filter by status: open, closed, or all.",
          inputSchema: {
            type: "object" as const,
            properties: {
              status: { type: "string", description: "Filter by status", enum: ["open", "closed", "all"] },
              limit: { type: "number", description: "Max orders to return (default: 20)" },
            },
          },
        },
        handler: async (args) => {
          try {
            const status = (args.status as string) || "open"
            const limit = Math.min((args.limit as number) || 20, 100)
            const orders = await getClient().getOrders(status, limit)

            if (orders.length === 0) return ok(`No ${status} orders [${modeLabel()}]`)

            const lines = [`${status.charAt(0).toUpperCase() + status.slice(1)} Orders [${modeLabel()}] (${orders.length})`, ``]
            for (const o of orders) {
              const time = new Date(o.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
              const filled = o.filled_avg_price ? ` @ $${formatMoney(o.filled_avg_price)}` : ""
              lines.push(
                `${o.side.toUpperCase()} ${o.qty} ${o.symbol} (${o.order_type})${filled}`,
                `  Status: ${o.status} | ${time}`,
                `  ID: ${o.id}`,
                ``
              )
            }
            return ok(lines.join("\n"))
          } catch (e) { return err(e instanceof Error ? e.message : String(e)) }
        },
      },

      {
        definition: {
          name: "alpaca_cancel_order",
          description: "Cancel a specific order by ID, or cancel all open orders.",
          inputSchema: {
            type: "object" as const,
            properties: {
              order_id: { type: "string", description: "Order ID to cancel. Omit to cancel ALL open orders." },
            },
          },
        },
        handler: async (args) => {
          try {
            const client = getClient()
            if (args.order_id) {
              await client.cancelOrder(args.order_id as string)
              return ok(`Order ${args.order_id} cancelled [${modeLabel()}]`)
            } else {
              await client.cancelAllOrders()
              return ok(`All open orders cancelled [${modeLabel()}]`)
            }
          } catch (e) { return err(e instanceof Error ? e.message : String(e)) }
        },
      },

      // ══════════════════════════════════════════════════════
      //  POSITION MANAGEMENT
      // ══════════════════════════════════════════════════════

      {
        definition: {
          name: "alpaca_close_position",
          description: "Close an open position partially or fully. Can specify qty or percentage.",
          inputSchema: {
            type: "object" as const,
            properties: {
              symbol: { type: "string", description: "Symbol to close" },
              qty: { type: "number", description: "Number of shares to sell (omit for full close)" },
              percentage: { type: "number", description: "Percentage of position to close (0-100)" },
            },
            required: ["symbol"],
          },
        },
        handler: async (args) => {
          try {
            const symbol = (args.symbol as string).toUpperCase()
            const qty = args.qty ? String(args.qty) : undefined
            const pct = args.percentage ? String(args.percentage) : undefined
            const result = await getClient().closePosition(symbol, qty, pct)

            return ok(`Position close order placed for ${symbol} [${modeLabel()}]\nStatus: ${result.status}\nOrder ID: ${result.id}`)
          } catch (e) { return err(e instanceof Error ? e.message : String(e)) }
        },
      },

      {
        definition: {
          name: "alpaca_close_all_positions",
          description: "LIQUIDATE all positions and optionally cancel all open orders. Use with extreme caution.",
          inputSchema: {
            type: "object" as const,
            properties: {
              cancel_orders: { type: "boolean", description: "Also cancel all open orders (default: true)" },
            },
          },
        },
        handler: async (args) => {
          try {
            const cancel = args.cancel_orders !== false
            await getClient().closeAllPositions(cancel)
            return ok(`All positions closed${cancel ? " and orders cancelled" : ""} [${modeLabel()}]`)
          } catch (e) { return err(e instanceof Error ? e.message : String(e)) }
        },
      },

      // ══════════════════════════════════════════════════════
      //  MARKET STATUS
      // ══════════════════════════════════════════════════════

      {
        definition: {
          name: "alpaca_market_clock",
          description: "Check if the market is currently open, and when it opens/closes next.",
          inputSchema: { type: "object" as const, properties: {}, required: [] },
        },
        handler: async () => {
          try {
            const clock = await getClient().getClock()
            const status = clock.is_open ? "OPEN" : "CLOSED"
            const nextOpen = new Date(clock.next_open).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })
            const nextClose = new Date(clock.next_close).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })

            const lines = [
              `Market is ${status}`,
              `Next Open: ${nextOpen}`,
              `Next Close: ${nextClose}`,
            ]
            return ok(lines.join("\n"))
          } catch (e) { return err(e instanceof Error ? e.message : String(e)) }
        },
      },

      // ══════════════════════════════════════════════════════
      //  WATCHLISTS
      // ══════════════════════════════════════════════════════

      {
        definition: {
          name: "alpaca_watchlists",
          description: "List, create, or view Alpaca watchlists.",
          inputSchema: {
            type: "object" as const,
            properties: {
              action: { type: "string", description: "Action to perform", enum: ["list", "create", "view"] },
              name: { type: "string", description: "Watchlist name (for create)" },
              symbols: { type: "array", items: { type: "string" }, description: "Symbols to add (for create)" },
              watchlist_id: { type: "string", description: "Watchlist ID (for view)" },
            },
          },
        },
        handler: async (args) => {
          try {
            const client = getClient()
            const action = (args.action as string) || "list"

            if (action === "create") {
              if (!args.name) return err("Name is required to create a watchlist.")
              const symbols = (args.symbols as string[]) || []
              await client.createWatchlist(args.name as string, symbols.map(s => s.toUpperCase()))
              return ok(`Watchlist "${args.name}" created with ${symbols.length} symbols`)
            }

            if (action === "view" && args.watchlist_id) {
              const wl = await client.getWatchlist(args.watchlist_id as string)
              const syms = wl.assets.map(a => a.symbol).join(", ")
              return ok(`${wl.name}: ${syms || "(empty)"}`)
            }

            const watchlists = await client.getWatchlists()
            if (watchlists.length === 0) return ok("No watchlists.")
            const lines = watchlists.map(w => `${w.name} (ID: ${w.id})`)
            return ok(`Watchlists:\n${lines.join("\n")}`)
          } catch (e) { return err(e instanceof Error ? e.message : String(e)) }
        },
      },
    ],
  }
}

export function deactivate(): void {
  // Nothing to clean up
}
