# Etherscan MCP Server Overview

## Goal

To create a comprehensive Model Context Protocol (MCP) server that provides easy access to the Etherscan V2 API endpoints. This server will allow users to query various Ethereum blockchain data directly through MCP tools.

**Note:** This MCP server itself acts as the bridge between MCP clients (like Claude Desktop) and the Etherscan REST API.

## Scope

The server aims to cover the following Etherscan API modules:

*   Accounts
*   Contracts
*   Transactions
*   Blocks
*   Logs
*   Geth/Parity Proxy
*   Tokens
*   Gas Tracker
*   Stats

Key aspects include handling various Etherscan parameters like pagination, sorting, block ranges, and **chain selection (`chainid`)**.

## Technology Stack

*   **Language:** TypeScript
*   **Framework:** MCP SDK for TypeScript
*   **API Client:** `axios` (or similar Node.js HTTP client)

## Authentication

*   Requires a standard Etherscan API Key (`apikey`).
*   The key will be configured via an environment variable (`ETHERSCAN_API_KEY`).

## Implementation Plan

1.  **Bootstrap:** Initialize a new TypeScript MCP server project using `npx @modelcontextprotocol/create-server`.
2.  **Core Implementation:**
    *   Develop a central client class/module (`EtherscanClient.ts` or similar) to handle interactions with the Etherscan API.
    *   Implement methods for each required Etherscan API endpoint, organized by module.
    *   Define corresponding MCP tools for each implemented endpoint, providing clear input parameters and output schemas.
    *   Implement robust error handling and comprehensive logging (`console.error`).
    *   Use TypeScript for strong typing.
3.  **Configuration:** Set up the server configuration in `settings.json`, including the command to run the built server and environment variable mapping for the API key.
4.  **Testing:** Rigorously test *each* MCP tool individually with valid and invalid inputs to ensure correctness and reliability, following the MCP Server Development Protocol.
5.  **Documentation:** Add basic usage instructions in a `README.md`.

## Development Process

*   Implement and test modules incrementally (e.g., start with Accounts, then Transactions, etc.).
*   Adhere strictly to the MCP Server Development Protocol, especially the testing requirements before completion.

## MCP Technical Details

This server leverages core Model Context Protocol concepts:

*   **Capabilities:** The server primarily exposes functionality via the **`tools`** capability. Each Etherscan API endpoint corresponds to an MCP tool discoverable and callable by clients (subject to user approval). It will declare this capability during initialization. `Resources` and `prompts` capabilities are not planned.
*   **Transport:** Communication with the MCP host (e.g., Claude Desktop) defaults to **Standard Input/Output (`stdio`)**, managed by the `@mcp/server` SDK. This is suitable for local execution.
*   **Configuration/Registration:** Users will need to register the server with their MCP client host, typically via the `mcp install` command or by manually editing the client's `settings.json` file, providing the path to the built server script and the necessary `ETHERSCAN_API_KEY` environment variable.
*   **Implementation Model (Asynchronous):** Due to reliance on network requests to the Etherscan API, all tool handlers **must** be implemented using **`async/await`** in TypeScript to avoid blocking the Node.js event loop.
