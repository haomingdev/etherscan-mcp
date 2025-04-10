# Etherscan MCP Server

A Model Context Protocol (MCP) server that provides tools for interacting with the Etherscan API across various EVM-compatible chains.

This server wraps a significant portion of the Etherscan API V2, exposing endpoints as MCP tools. It allows AI assistants like Claude to query blockchain data such as balances, transactions, contract details, logs, and more.

## Features

This server exposes the following Etherscan API endpoints as MCP tools:

**Account Module:**

- `etherscan_getBalance`: Get Ether balance for a single address.
- `etherscan_getMultiBalance`: Get Ether balance for multiple addresses.
- `etherscan_getNormalTransactions`: Get normal transactions for an address.
- `etherscan_getInternalTransactions`: Get internal transactions by address or transaction hash.
- `etherscan_getTokenTransfers`: Get ERC20/721/1155 token transfers.
- `etherscan_getMinedBlocks`: Get blocks validated by an address.

**Contract Module:**

- `etherscan_getSourceCode`: Get source code and metadata for a verified contract.
- `etherscan_getAbi`: Get ABI for a verified contract.

**Token Module:**

- `etherscan_getTokenSupply`: Get total supply of an ERC20 token.
- `etherscan_getTokenInfo`: Get information about a token.

**Transaction Module:**

- `etherscan_getTransactionReceiptStatus`: Get status code of a transaction receipt (post-Byzantium).
- `etherscan_getTransactionStatus`: Check execution status of a transaction.

**Logs Module:**

- `etherscan_getLogs`: Get event logs matching specified criteria.

**Geth/Proxy Module:**

- `etherscan_eth_blockNumber`: Get the number of the most recent block.
- `etherscan_eth_getBlockByNumber`: Get information about a block by number.
- `etherscan_eth_getBlockTransactionCountByNumber`: Get transaction count in a block.
- `etherscan_eth_getTransactionByHash`: Get transaction details by hash.
- `etherscan_eth_getTransactionByBlockNumberAndIndex`: Get transaction details by block and index.
- `etherscan_eth_getTransactionCount`: Get the nonce (transaction count) of an address.
- `etherscan_eth_sendRawTransaction`: Submit a pre-signed raw transaction (POST).
- `etherscan_eth_getTransactionReceipt`: Get the receipt of a transaction by hash.
- `etherscan_eth_call`: Execute a read-only call to a contract.
- `etherscan_eth_getCode`: Get the bytecode at an address.
- `etherscan_eth_getStorageAt`: Get the value from a storage position.
- `etherscan_eth_gasPrice`: Get the current gas price.
- `etherscan_eth_estimateGas`: Estimate gas needed for a transaction.

## Setup

1.  **API Key:** Obtain an API key from [Etherscan](https://etherscan.io/myapikey).
2.  **Environment Variable:** Set the `ETHERSCAN_API_KEY` environment variable. You can do this by:
    - Creating a `.env` file in the project root:
      ```
      ETHERSCAN_API_KEY=YOUR_ACTUAL_API_KEY
      ```
    - Or by setting it directly in your system environment or MCP configuration.

## Development

Install dependencies:

```bash
npm install
```

Build the server:

```bash
npm run build
```

Run the server in development mode (watches for changes):

```bash
npm run dev
```

Run end-to-end tests (requires server to be built):

```bash
node dist/test/e2e.js
```

## Installation & Configuration

To use this server with an MCP host (like the Claude Desktop App or VS Code Extension):

1.  **Build the Server:** Ensure you have built the server using `npm run build`. The executable will be at `dist/index.js`.
2.  **Configure MCP Host:** Add the server configuration to your MCP host's settings file.

    - **VS Code Extension (`settings.json`):**
      ```json
      "cline.mcp.servers": {
        "etherscan-mcp": {
          "command": "node",
          "args": ["/full/path/to/etherscan-mcp/dist/index.js"], // <-- IMPORTANT: Use absolute path
          "env": {
            "ETHERSCAN_API_KEY": "YOUR_ACTUAL_API_KEY" // Or ensure it's set in the environment
          },
          "disabled": false,
          "autoApprove": []
        }
      }
      ```
    - **Claude Desktop App:**
      - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
      - Windows: `%APPDATA%/Claude/claude_desktop_config.json`
      ```json
      {
        "mcpServers": {
          "etherscan-mcp": {
            "command": "node",
            "args": ["/full/path/to/etherscan-mcp/dist/index.js"], // <-- IMPORTANT: Use absolute path
            "env": {
              "ETHERSCAN_API_KEY": "YOUR_ACTUAL_API_KEY" // Or ensure it's set in the environment
            },
            "disabled": false,
            "autoApprove": []
          }
        }
      }
      ```

    **Note:** Replace `/full/path/to/etherscan-mcp/dist/index.js` with the actual absolute path to the compiled server file on your system. Replace `YOUR_ACTUAL_API_KEY` if setting the key directly in the configuration.

3.  **Restart MCP Host:** Restart your MCP host application for the changes to take effect.

## Usage Examples (with `use_mcp_tool`)

**Get Balance:**

```xml
<use_mcp_tool>
  <server_name>etherscan-mcp</server_name>
  <tool_name>etherscan_getBalance</tool_name>
  <arguments>
  {
    "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "chainId": 1
  }
  </arguments>
</use_mcp_tool>
```

**Get Recent Transactions:**

```xml
<use_mcp_tool>
  <server_name>etherscan-mcp</server_name>
  <tool_name>etherscan_getNormalTransactions</tool_name>
  <arguments>
  {
    "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "chainId": 1,
    "page": 1,
    "offset": 5,
    "sort": "desc"
  }
  </arguments>
</use_mcp_tool>
```

**Get Contract ABI:**

```xml
<use_mcp_tool>
  <server_name>etherscan-mcp</server_name>
  <tool_name>etherscan_getAbi</tool_name>
  <arguments>
  {
    "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "chainId": 1
  }
  </arguments>
</use_mcp_tool>
```

## Debugging

Since MCP servers communicate over stdio, direct debugging can be tricky.

- **Server Logs:** Check the server's `stderr` output (logged via `console.error` in the code) for initialization and request handling information.
- **MCP Inspector:** Use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) for detailed request/response inspection. You might need to adapt its connection method depending on how you run the server.
