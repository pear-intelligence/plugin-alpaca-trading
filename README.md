# Alpaca Trading Plugin (Dual Mode)

A [Pear Intelligence](https://github.com/pear-intelligence/pear-intelligence) plugin for trading stocks, crypto, and options via the [Alpaca](https://alpaca.markets/) brokerage API. Supports simultaneous **paper trading** (simulated) and **live trading** (real money) in the same plugin.

## Features

- **Dual Mode Trading** — Use both paper and live accounts simultaneously without switching
- **Account overview** — Equity, buying power, cash, margin, day trade count for both accounts
- **Position management** — View all positions, close partially or fully, liquidate all
- **Order execution** — Market, limit, stop, stop-limit, and trailing-stop orders
- **Crypto trading** — Buy/sell crypto pairs (BTC/USD, ETH/USD, etc.) by qty or dollar amount
- **Options trading** — Search contracts, view chains with Greeks, place options orders, exercise contracts
- **Real-time quotes** — Stock snapshots with bid/ask, daily OHLCV, prev close
- **Historical bars** — Flexible timeframes from 1-minute to monthly
- **Portfolio history** — Equity and P&L over time for performance tracking
- **Market status** — Check if market is open, next open/close times
- **Watchlists** — Create, view, and manage watchlists

## Installation

Install from the Pear Intelligence marketplace in the iOS app, or via the API:

```bash
curl -X POST http://localhost:3000/plugins/marketplace/install \
  -H "Content-Type: application/json" \
  -d '{"name": "alpaca-trading", "repoUrl": "https://github.com/pear-intelligence/plugin-alpaca-trading"}'
```

## Setup

1. Create an Alpaca account at [alpaca.markets/signup](https://app.alpaca.markets/signup)
2. Get your API Keys and Secrets from the Alpaca dashboard (both paper and live if desired)
3. Open the Pear Intelligence app → Settings → Plugins → Alpaca Trading
4. Configure credentials:
   - **Paper Trading**: Enter `paperApiKey` and `paperSecretKey`
   - **Live Trading**: Enter `liveApiKey` and `liveSecretKey`
5. Both modes can be used simultaneously - just specify `mode: "paper"` or `mode: "live"` when calling tools

## MCP Tools

### Account & Portfolio

| Tool | Description |
|------|-------------|
| `alpaca_account` | Account info: equity, cash, buying power, margin |
| `alpaca_positions` | All open positions with P&L |
| `alpaca_portfolio_history` | Equity and P&L history over time |

### Market Data

| Tool | Description |
|------|-------------|
| `alpaca_quote` | Real-time stock snapshot (price, bid/ask, daily bar) |
| `alpaca_quotes` | Multiple stock snapshots at once |
| `alpaca_bars` | Historical OHLCV bars with configurable timeframe |
| `alpaca_crypto_quote` | Real-time crypto pair snapshot |

### Trading

| Tool | Description |
|------|-------------|
| `alpaca_place_order` | Place stock/ETF orders (market, limit, stop, trailing) |
| `alpaca_place_crypto_order` | Place crypto orders (by qty or dollar amount) |
| `alpaca_orders` | List orders filtered by status |
| `alpaca_cancel_order` | Cancel one or all open orders |

### Options Trading

| Tool | Description |
|------|-------------|
| `alpaca_option_contracts` | Search option contracts by symbol, expiration, strike, call/put |
| `alpaca_option_chain` | Full option chain with Greeks (delta, gamma, theta, vega, rho, IV) |
| `alpaca_option_quotes` | Real-time snapshots for specific option contracts |
| `alpaca_place_option_order` | Place options orders (market, limit, stop, stop-limit) |
| `alpaca_exercise_option` | Exercise a held option contract |

### Position Management

| Tool | Description |
|------|-------------|
| `alpaca_close_position` | Close a position (partial or full) |
| `alpaca_close_all_positions` | Liquidate entire portfolio |

### Market & Watchlists

| Tool | Description |
|------|-------------|
| `alpaca_market_clock` | Market open/closed status and schedule |
| `alpaca_watchlists` | Create, view, and manage watchlists |

## HTTP Routes

When enabled, the plugin also exposes REST endpoints under `/px/alpaca-trading/`:

- `GET /px/alpaca-trading/accounts` — Both paper and live account info JSON
- `GET /px/alpaca-trading/positions/:mode` — Open positions JSON (mode: paper or live)
- `GET /px/alpaca-trading/orders/:mode` — Open orders JSON (mode: paper or live)
- `GET /px/alpaca-trading/clock` — Market clock JSON

## Trading Modes

| Mode | Description | Risk |
|------|-------------|------|
| **Paper** | Simulated trading with fake money | None |
| **Live** | Real money, real trades | Real financial risk |

Both modes are available simultaneously. When calling any trading tool, specify `mode: "paper"` or `mode: "live"` as a required parameter. This allows you to:
- Test strategies on paper while trading live
- Compare performance between accounts
- Manage both accounts from a single interface

## Safety

- All trading tools require explicit `mode` parameter (`"paper"` or `"live"`) - no default mode
- The plugin always displays `[PAPER]` or `[LIVE]` in tool responses so you know which account is being used
- Order placement tools include descriptions reminding to specify and confirm the mode
- The `close_all_positions` tool is clearly labeled as a liquidation action
- Market data tools (quotes, bars) use whichever credentials are available (paper or live) since data is the same

## Development

This plugin follows the [Pear Intelligence plugin spec](https://github.com/pear-intelligence/pear-intelligence/blob/master/plugins/EXTENSION.md). The entry point is `index.ts` with `activate()` and `deactivate()` exports.

## License

MIT
