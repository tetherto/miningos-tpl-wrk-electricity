# miningos-tpl-wrk-electricity

Template worker for electricity monitoring, spot price forecasting, and mining profitability calculations in MiningOS.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Starting the Worker](#starting-the-worker)
6. [Architecture](#architecture)
7. [API Reference](#api-reference)
8. [Development](#development)
9. [Troubleshooting](#troubleshooting)
10. [Contributing](#contributing)

## Overview

The Electricity Worker Template provides a foundation for building electricity monitoring workers that:
- Track electricity costs and revenue for mining operations
- Process spot price forecast data
- Calculate mining profitability based on hashrate and power consumption
- Store and retrieve historical energy data
- Provide 24-hour uptime range calculations

This is a **template repository** - most methods are no-ops designed to be overridden in concrete implementations for specific electricity providers or data sources.

## Prerequisites

- Node.js >= 20.0
- Understanding of Hyperswarm RPC (for P2P communication)
- Access to electricity data sources (for concrete implementations)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/tetherto/miningos-tpl-wrk-electricity.git
cd miningos-tpl-wrk-electricity
```

2. Install dependencies:
```bash
npm install
```

3. Setup configuration files:
```bash
bash setup-config.sh
# For test configurations as well:
bash setup-config.sh --test
```

## Configuration

### Common Configuration (config/common.json)

Basic worker configuration:

```json
{
  "dir_log": "logs",
  "debug": 0
}
```

### Network Configuration (config/facs/net.config.json)
Configure Hyperswarm network settings for RPC communication with other workers.

### Storage Configuration (config/facs/store.config.json)
Configure Hyperbee database settings for persistent storage.

**Note**: After running `setup-config.sh`, edit the generated config files with your specific settings.

## Starting the Worker

### Development Mode
```bash
node worker.js --wtype wrk-electricity-rack --env development --rack rack-0
```

### Production Mode
```bash
node worker.js --wtype wrk-electricity-rack --env production --rack rack-1
```

### Parameters
- `--wtype`: Worker type identifier (e.g., `wrk-electricity-rack`)
- `--env`: Environment (`development`, `production`)
- `--rack`: Rack identifier (e.g., `rack-0`, `rack-1`)

## Architecture

### Core Components

#### Worker Class: `WrkElectricityRack`
Main worker class that extends `TetherWrkBase` from `tether-wrk-base`.

**File**: `workers/rack.electricity.wrk.js`

Key responsibilities:
- Exposes RPC endpoints for electricity data retrieval
- Manages worker settings persistence
- Handles data queries via `getWrkExtData` method

#### Settings Management
**File**: `workers/lib/wrk-fun-settings.js`

Provides:
- `getSettings()` - Retrieve worker settings from Hyperbee storage
- `saveSettingsEntries(entries)` - Update and persist settings

### Data Storage

Uses **Hyperbee** (SQLite-backed key-value store) via `hp-svc-facs-store`:
- Storage location: `store/${rack}-db`
- Settings key: `settings_00`
- Provides fast, persistent storage for worker configuration

### RPC Communication

Workers communicate via Hyperswarm RPC:
- Uses public keys for peer discovery
- Exposes `getWrkExtData` method for data queries
- Supports `getWrkSettings` and `saveWrkSettings` for configuration

## API Reference

### Primary RPC Method: `getWrkExtData`

The main endpoint for retrieving electricity data. All requests must include a `query` object with a `key` property.

**Request Structure:**
```javascript
{
  query: {
    key: string,        // Required: determines operation
    // Additional properties depend on key type
  },
  data?: any           // Optional: used for certain operations
}
```

### Supported Query Keys

#### 1. `margin`
Retrieves the configured margin value for profitability calculations.

**Payload:**
```javascript
{
  query: { key: 'margin' }
}
```

**Returns:** Number representing margin percentage or 0 if not configured.

---

#### 2. `revenue-estimates`
Retrieves weekly revenue estimates from the database.

**Payload:**
```javascript
{
  query: {
    key: 'revenue-estimates',
    start: number,        // Unix timestamp (ms) - range start
    end: number,          // Unix timestamp (ms) - range end
    fields?: object       // Optional: projection fields
  }
}
```

**Returns:** Array of weekly revenue estimate objects.

---

#### 3. `spot-price`
Retrieves spot price forecast data for a given time range.

**Payload:**
```javascript
{
  query: {
    key: 'spot-price',
    start: number,        // Unix timestamp (ms) - range start
    end: number,          // Unix timestamp (ms) - range end
    fields?: object       // Optional: projection fields
  }
}
```

**Returns:** Array of spot price forecast objects (timestamp, USD/MWh).

---

#### 4. `uptimeRange`
Calculates 24-hour uptime range metrics based on provided data.

**Payload:**
```javascript
{
  query: { key: 'uptimeRange' },
  data: any              // Required: uptime data to analyze
}
```

**Returns:** Calculated 24-hour uptime range metrics.

**Note:** This is the only fully implemented method in the template.

---

#### 6. `stats`
Retrieves current electricity statistics.

**Payload:**
```javascript
{
  query: {
    key: 'stats',
    fields?: object       // Optional: projection fields
  }
}
```

**Returns:** Comprehensive stats object containing:
- Active and reactive energy (1-hour and 15-minute intervals)
- UTE energy data
- Spot prices
- Next hour energy values
- Hashrate and consumption metrics

---

#### 7. `cost-revenue`
Retrieves historical hourly cost and revenue data with optional aggregation.

**Payload:**
```javascript
{
  query: {
    key: 'cost-revenue',
    start: number,        // Unix timestamp (ms) - range start
    end: number,          // Unix timestamp (ms) - range end
    fields?: object,      // Optional: projection fields
    aggrDaily?: boolean,  // Optional: aggregate by day
    aggrHourly?: boolean  // Optional: aggregate by hour
  }
}
```

**Returns:** Array of cost-revenue objects (raw or aggregated).

---

#### 8. `stats-history`
Retrieves aggregated historical statistics grouped by day or month.

**Payload:**
```javascript
{
  query: {
    key: 'stats-history',
    start: number,        // Unix timestamp (ms) - range start
    end: number,          // Unix timestamp (ms) - range end
    groupRange: string,   // Required: 'D1' (daily) or 'MONTH1' (monthly)
    dataInterval: string, // Required: '15min' or '1h'
    fields?: object       // Optional: projection fields
  }
}
```

**Returns:** Array of aggregated statistics containing:
- Aggregated active and reactive energy values
- Aggregated spot price (averaged)
- Aggregated UTE energy
- Timestamp and grouping label
- Count of records aggregated

---

### Error Handling

The method throws errors for invalid inputs:
- `ERR_QUERY_INVALID`: Missing or invalid query object
- `ERR_KEY_INVALID`: Missing key property in query

### Using the RPC CLI

Interact with the worker using `hp-rpc-cli`:

```bash
# Get margin value
hp-rpc-cli -s RPC_KEY \
  -m 'getWrkExtData' \
  -d '{"query": {"key": "margin"}}'

# Get cost-revenue with daily aggregation
hp-rpc-cli -s RPC_KEY \
  -m 'getWrkExtData' \
  -d '{"query": {"key": "cost-revenue", "start": 1697500800000, "end": 1697587200000, "aggrDaily": true}}'

# Get stats history grouped by day
hp-rpc-cli -s RPC_KEY \
  -m 'getWrkExtData' \
  -d '{"query": {"key": "stats-history", "start": 1697500800000, "end": 1700179200000, "groupRange": "D1", "dataInterval": "1h"}}'

## Development

### Running Tests
```bash
npm test              # Run all tests (currently runs lint)
npm run lint          # Check code style (Standard.js)
npm run lint:fix      # Auto-fix linting issues
```

### Project Structure
```
.
├── config/              # Configuration files
│   ├── common.json.example
│   └── facs/            # Facility configs (net, store, etc.)
├── workers/
│   ├── rack.electricity.wrk.js  # Main worker class
│   └── lib/
│       ├── wrk-fun-settings.js  # Settings persistence
│       └── utils.js             # Utility functions
├── mock/
│   └── mock-control-agent.js    # Mock service for testing
├── setup-config.sh      # Config file generator
└── worker.js            # Entry point
```

### Implementing a Concrete Worker

This is a template - override the no-op methods in your implementation:

1. Extend `WrkElectricityRack` class
2. Implement the query methods:
   - `getRevenueEstimates(req)`
   - `getSpotPrice(req)`
   - `calcCostAndRevenue(req)`
   - `getStats(req)`
   - `getCostRevenue(req)`
   - `getStatsHistory(req)`
3. Add your electricity data source integration
4. Configure data polling/fetching schedules
5. Add appropriate error handling and logging

## Troubleshooting

### Common Issues

1. **Configuration files missing**
   - Run `bash setup-config.sh` to generate from templates
   - Verify all `.example` files have been processed

2. **Worker fails to start**
   - Check that `--rack` parameter is provided
   - Verify Node.js version >= 16.0
   - Review logs in `logs/` directory (if configured)

3. **RPC connection failures**
   - Verify network configuration in `config/facs/net.config.json`
   - Check that Hyperswarm network is accessible
   - Ensure RPC public keys are correct

4. **Storage errors**
   - Check `store/${rack}-db` directory exists and is writable
   - Verify storage configuration in `config/facs/store.config.json`
   - Ensure sufficient disk space

5. **Methods returning undefined**
   - Remember: most methods are no-ops in this template
   - Implement concrete methods in your derived class
   - Only `uptimeRange` is fully implemented

## Contributing

Contributions are welcome and appreciated!

### How to Contribute

1. **Fork** the repository
2. **Create a new branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** and ensure tests pass:
   ```bash
   npm test
   ```
4. **Push** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
5. **Open a Pull Request** describing what you changed and why

### Guidelines

- Follow Standard.js code style (`npm run lint`)
- Add tests for new functionality
- Keep PRs focused—one feature or fix per pull request
- Update documentation as needed
- Ensure all tests pass before submitting
- Consider backward compatibility for template users
