# Alpaca Trading Plugin

A [Pear Intelligence](https://github.com/pear-intelligence/pear-intelligence) plugin for trading stocks, crypto, and options via the [Alpaca](https://alpaca.markets/) brokerage API. Supports both **paper trading** (simulated) and **live trading** (real money).

## Features

- **Account overview** — Equity, buying power, cash, margin, day trade count
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
2. Get your API Key and Secret from the Alpaca dashboard (paper or live)
3. Open the Pear Intelligence app → Settings → Plugins → Alpaca Trading
4. Enter your API Key and Secret Key
5. Select trading mode: **Paper** (default, simulated) or **Live** (real money)

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

- `GET /px/alpaca-trading/account` — Account info JSON
- `GET /px/alpaca-trading/positions` — Open positions JSON
- `GET /px/alpaca-trading/orders` — Open orders JSON
- `GET /px/alpaca-trading/clock` — Market clock JSON

## Trading Modes

| Mode | Description | Risk |
|------|-------------|------|
| **Paper** (default) | Simulated trading with fake money | None |
| **Live** | Real money, real trades | Real financial risk |

Paper mode is the default. To switch to live trading, change the "Trading Mode" setting and use your live API credentials.

## Safety

- The plugin always displays `[PAPER]` or `[LIVE]` in tool responses so you know which mode you're in
- Order placement tools include descriptions reminding to confirm the mode with the user
- The `close_all_positions` tool is clearly labeled as a liquidation action

## Development

This plugin follows the [Pear Intelligence plugin spec](https://github.com/pear-intelligence/pear-intelligence/blob/master/plugins/EXTENSION.md). The entry point is `index.ts` with `activate()` and `deactivate()` exports.

## License

MIT
