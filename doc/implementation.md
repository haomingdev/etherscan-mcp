# Etherscan MCP Server: Implementation Plan

This document outlines the phased plan for building the Etherscan MCP server.

## Core MCP Concepts for this Server

- **Capabilities:** This server will primarily expose **Tools**. Each Etherscan API endpoint will be mapped to an MCP Tool. The server will declare the `tools` capability upon initialization. We do not plan to implement `resources` or `prompts`.
- **Transport:** The `@mcp/server` SDK handles transport, defaulting to **stdio** for communication with the MCP Host (suitable for local development).
- **Implementation Model:** The implementation will be **asynchronous** (`async/await` in TypeScript) due to network I/O for Etherscan API calls.

## Phase 1: Setup and Foundation (Completed)

- **Goals:** Establish the project structure, core dependencies, basic API client, and foundational configurations.

| Step | Task Description                                                                                                                                                                         | Status |
| :--- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 1.1  | Run `npx @modelcontextprotocol/create-server .` (Ensure you are _inside_ the `etherscan-mcp` directory)                                                                                  | `[X]`  |
| 1.2  | Run `npm install` (or `yarn install`)                                                                                                                                                    | `[X]`  |
| 1.3  | Initialize Git repository: `git init && git add . && git commit -m "Initial commit from @mcp/create-server"`                                                                             | `[X]`  |
| 1.4  | Verify expected project structure (src/, dist/, package.json, tsconfig.json, etc.)                                                                                                       | `[X]`  |
| 1.5  | Install additional dependencies: `npm install axios dotenv zod` (Added Zod)                                                                                                              | `[X]`  |
| 1.6  | Create `.env` file in `etherscan-mcp` root with `ETHERSCAN_API_KEY=YOUR_ACTUAL_API_KEY`.                                                                                                 | `[X]`  |
| 1.7  | Create `.gitignore` in `etherscan-mcp` root; add `node_modules/`, `dist/`, `.env`.                                                                                                       | `[X]`  |
| 1.8  | Review/adjust `tsconfig.json`, `package.json` scripts (build, dev, start), `.eslintrc.js` (defaults often okay initially).                                                               | `[X]`  |
| 1.9  | Create `src/utils/client.ts` and define `EtherscanClient` class shell.                                                                                                                   | `[X]`  |
| 1.10 | Implement `EtherscanClient` constructor (accept `apiKey`, store `baseURL`).                                                                                                              | `[X]`  |
| 1.11 | Implement initial private `_request` helper in `EtherscanClient` using `axios` (handle GET, append API key, basic error handling/logging).                                               | `[X]`  |
| 1.12 | Create `src/utils/types.ts` and define initial basic interfaces (e.g., `EtherscanBaseResponse`).                                                                                         | `[X]`  |
| 1.13 | Create `src/tools/` directory.                                                                                                                                                           | `[X]`  |
| 1.14 | Create `src/index.ts` - main server entry point.                                                                                                                                         | `[X]`  |
| 1.15 | Implement basic `src/index.ts`: load `.env`, instantiate `EtherscanClient`, instantiate `Server` from `@mcp/server`, set capabilities (`tools`), add placeholders for tool registration. | `[X]`  |
| 1.16 | Decide on strategy for handling `chainid` (confirm: parameter in tool inputs).                                                                                                           | `[X]`  |
| 1.17 | Understand stdio transport is handled by SDK (no explicit setup needed in `index.ts`).                                                                                                   | `[X]`  |

## Phase 2A: Accounts Module - Initial Implementation & Testing (Completed)

- **Goals:** Implement and test `balance`, `balancemulti`, `txlist` actions.

| Step | Task Description                                                                                                                                                                                                          | Status |
| :--- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----- |
| 2A.1 | **Accounts:** Define specific response interfaces in `src/utils/types.ts` for `balance`, `balancemulti`, `txlist` (e.g., `BalanceResponse`, `TxListResponse`).                                                            | `[X]`  |
| 2A.2 | **Accounts:** Implement methods in `EtherscanClient` for `balance`, `balancemulti`, `txlist`.                                                                                                                             | `[X]`  |
| 2A.3 | **Accounts:** Create `src/tools/account.ts` (or similar).                                                                                                                                                                 | `[X]`  |
| 2A.4 | **Accounts:** Define MCP tools in `account.ts` using `mcp.createTool` for `balance`, `balancemulti`, `txlist` (use Zod `inputSchema`).                                                                                    | `[X]`  |
| 2A.5 | **Accounts:** Register `balance`, `balancemulti`, `txlist` tools in `src/index.ts`.                                                                                                                                       | `[X]`  |
| 2A.6 | **Accounts Testing (Completed):** Use `mcp run tool` (or Inspector) to test `etherscan.getBalance`, `etherscan.getMultiBalance`, `etherscan.getNormalTransactions` (`txlist`) with valid/invalid addresses and chain IDs. | `[X]`  |
| 2A.7 | Document test results/findings for Phase 2A completed tests.                                                                                                                                                              | `[ ]`  |

## Phase 2B: Accounts Module - Remaining Implementation (Completed)

- **Goals:** Implement the remaining Accounts module actions: `txlistinternal`, `tokentx`, `getminedblocks`.

| Step | Task Description                                                                                                                                                                                        | Status |
| :--- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----- |
| 2B.1 | **Accounts:** Define specific response interfaces in `src/utils/types.ts` for `txlistinternal`, `tokentx`, `getminedblocks` (e.g., `InternalTxListResponse`, `TokenTxResponse`, `MinedBlocksResponse`). | `[X]`  |
| 2B.2 | **Accounts:** Implement methods in `EtherscanClient` for `txlistinternal`, `tokentx`, `getminedblocks`.                                                                                                 | `[X]`  |
| 2B.3 | **Accounts:** Define MCP tools in `account.ts` using `mcp.createTool` for `txlistinternal`, `tokentx`, `getminedblocks` (use Zod `inputSchema`).                                                        | `[X]`  |
| 2B.4 | **Accounts:** Register `txlistinternal`, `tokentx`, `getminedblocks` tools in `src/index.ts`.                                                                                                           | `[X]`  |

## Phase 2C: Accounts Module - Remaining Testing (Completed)

- **Goals:** Test the remaining Accounts module actions implemented in Phase 2B.

| Step | Task Description                                                                                                                                                                                                                                 | Status |
| :--- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 2C.1 | **Accounts Testing (Completed):** Test `etherscan.getInternalTransactions` (`txlistinternal`) with appropriate parameters (address, blocks, pagination).                                                                                         | `[X]`  |
| 2C.2 | **Accounts Testing (Completed):** Test `etherscan.getTokenTransfers` (`tokentx`) with appropriate parameters (address/contractaddress, blocks, pagination).                                                                                      | `[X]`  |
| 2C.3 | **Accounts Testing (Completed):** Test `etherscan.getMinedBlocks` (`getminedblocks`) with appropriate parameters (address).                                                                                                                      | `[X]`  |
| 2C.4 | Document test results/findings for Phase 2C tests once completed. **Findings:** All Phase 2B tools (`getInternalTransactions`, `getTokenTransfers`, `getMinedBlocks`) tested successfully via MCP Inspector/`use_mcp_tool` after server restart. | `[X]`  |

## Phase 3: Contracts Module - Implementation & Testing (Completed)

- **Goals:** Implement and test endpoints for the Contracts module, focusing on `getsourcecode`.

| Step | Task Description                                                                                                                                               | Status |
| :--- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 3.1  | **Contracts:** Define specific response interfaces in `src/utils/types.ts` (e.g., `GetSourceCodeResponse`, `GetAbiResponse`).                                  | `[X]`  |
| 3.2  | **Contracts:** Implement client method `getSourceCode` in `EtherscanClient`.                                                                                   | `[X]`  |
| 3.3  | **Contracts:** Implement client method `getAbi` in `EtherscanClient`.                                                                                          | `[X]`  |
| 3.4  | **Contracts:** Create `src/tools/contract.ts`.                                                                                                                 | `[X]`  |
| 3.5  | **Contracts:** Define MCP tool `etherscan.getSourceCode` in `contract.ts` using `mcp.createTool` (Zod `inputSchema` for address, chainid).                     | `[X]`  |
| 3.6  | **Contracts:** Define MCP tool `etherscan.getAbi` in `contract.ts` using `mcp.createTool` (Zod `inputSchema` for address, chainid).                            | `[X]`  |
| 3.7  | **Contracts:** Register `getSourceCode` and `getAbi` tools in `src/index.ts`.                                                                                  | `[X]`  |
| 3.8  | **Contracts Testing (Completed):** Test `etherscan.getSourceCode` using `use_mcp_tool` with verified contract address (USDT) and chain ID 1.                   | `[X]`  |
| 3.9  | **Contracts Testing (Completed):** Test `etherscan.getAbi` using `use_mcp_tool` with verified contract address (USDT) and chain ID 1.                          | `[X]`  |
| 3.10 | Document test results/findings for Phase 3. **Findings:** Both `getSourceCode` and `getAbi` tools tested successfully via `use_mcp_tool` after server restart. | `[X]`  |

## Phase 4: Tokens Module - Implementation & Testing (Completed)

- **Goals:** Implement and test endpoints for the Tokens module, focusing on `tokensupply`.

| Step | Task Description                                                                                                                                                      | Status |
| :--- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 4.1  | **Tokens:** Define specific response interfaces in `src/utils/types.ts` (e.g., `TokenSupplyResponse`, `TokenInfoResponse`).                                           | `[X]`  |
| 4.2  | **Tokens:** Implement client method `getTokenSupply` in `EtherscanClient`.                                                                                            | `[X]`  |
| 4.3  | **Tokens:** Implement client method `getTokenInfo` (optional, if desired) in `EtherscanClient`.                                                                       | `[X]`  |
| 4.4  | **Tokens:** Create `src/tools/token.ts`.                                                                                                                              | `[X]`  |
| 4.5  | **Tokens:** Define MCP tool `etherscan.getTokenSupply` in `token.ts` using `mcp.createTool` (Zod `inputSchema` for contractaddress, chainid).                         | `[X]`  |
| 4.6  | **Tokens:** Define MCP tool `etherscan.getTokenInfo` (optional) in `token.ts`.                                                                                        | `[X]`  |
| 4.7  | **Tokens:** Register `getTokenSupply` and other token tools in `src/index.ts`.                                                                                        | `[X]`  |
| 4.8  | **Tokens Testing (Completed):** Test `etherscan.getTokenSupply` using `use_mcp_tool` with valid token contract address (USDT) and chain ID 1.                         | `[X]`  |
| 4.9  | **Tokens Testing (Completed):** Test `etherscan.getTokenInfo` (if implemented) using `use_mcp_tool` with valid token contract address (USDT) and chain ID 1.          | `[X]`  |
| 4.10 | Document test results/findings for Phase 4. **Findings:** Both `getTokenSupply` and `getTokenInfo` tools tested successfully via `use_mcp_tool` after server restart. | `[X]`  |

## Phase 5: Transactions Module - Implementation & Testing

- **Goals:** Implement and test endpoints for the Transactions module.

| Step | Task Description                                                                                                                                                                                                                                                                                                                                                                      | Status |
| :--- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----- |
| 5.1  | **Transactions:** Define specific response/request types in `src/utils/types.ts` (e.g., `TxReceiptStatusResponse`, `TxExecutionStatusResponse`).                                                                                                                                                                                                                                      | `[X]`  |
| 5.2  | **Transactions:** Implement client method `getTransactionReceiptStatus` in `EtherscanClient`.                                                                                                                                                                                                                                                                                         | `[X]`  |
| 5.3  | **Transactions:** Implement client method `getTransactionStatus` in `EtherscanClient`.                                                                                                                                                                                                                                                                                                | `[X]`  |
| 5.4  | **Transactions:** Create `src/tools/transaction.ts`.                                                                                                                                                                                                                                                                                                                                  | `[X]`  |
| 5.5  | **Transactions:** Define MCP tool `etherscan.getTransactionReceiptStatus` in `transaction.ts` (Zod `inputSchema` for txhash, chainid).                                                                                                                                                                                                                                                | `[X]`  |
| 5.6  | **Transactions:** Define MCP tool `etherscan.getTransactionStatus` in `transaction.ts` (Zod `inputSchema` for txhash, chainid).                                                                                                                                                                                                                                                       | `[X]`  |
| 5.7  | **Transactions:** Register transaction tools in `src/index.ts`.                                                                                                                                                                                                                                                                                                                       | `[X]`  |
| 5.8  | **Transactions Testing:** Test `etherscan.getTransactionReceiptStatus` using `mcp run tool` with valid/invalid tx hashes and chain IDs.                                                                                                                                                                                                                                               | `[X]`  |
| 5.9  | **Transactions Testing:** Test `etherscan.getTransactionStatus` using `mcp run tool` with valid/invalid tx hashes and chain IDs.                                                                                                                                                                                                                                                      | `[X]`  |
| 5.10 | Document test results/findings for Phase 5. **Findings:** Both `getTransactionReceiptStatus` and `getTransactionStatus` tested successfully via `use_mcp_tool` with valid hash `0x45047bbfa0cef069b18db64732d2d4b56c6cd39bc8e7fa76f84a4c7c53c752eb` on chain ID 1 after server restart. Initial test failure for `getTransactionReceiptStatus` was due to using an invalid test hash. | `[X]`  |

## Phase 6: Logs Module - Implementation & Testing

- **Goals:** Implement and test endpoints for the Logs module.

| Step | Task Description                                                                                                                                                                                                                                                             | Status |
| :--- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 6.1  | **Logs:** Define specific response interfaces in `src/utils/types.ts` (e.g., `GetLogsResponse`).                                                                                                                                                                             | `[X]`  |
| 6.2  | **Logs:** Implement client method `getLogs` in `EtherscanClient`.                                                                                                                                                                                                            | `[X]`  |
| 6.3  | **Logs:** Create `src/tools/log.ts`.                                                                                                                                                                                                                                         | `[X]`  |
| 6.4  | **Logs:** Define MCP tool `etherscan.getLogs` in `log.ts` (Zod `inputSchema` for address, topics, blocks, chainid).                                                                                                                                                          | `[X]`  |
| 6.5  | **Logs:** Register `getLogs` tool in `src/index.ts`.                                                                                                                                                                                                                         | `[X]`  |
| 6.6  | **Logs Testing:** Test `etherscan.getLogs` using `mcp run tool`, focusing on different topic/address/block parameters and chain IDs.                                                                                                                                         | `[X]`  |
| 6.7  | Document test results/findings for Phase 6. **Findings:** `etherscan_getLogs` tested successfully via `use_mcp_tool` after server restart. Tests included basic fetch (USDT contract, block range), topic filtering (USDT transfers), and invalid input (missing `chainId`). | `[X]`  |

## Phase 7: Geth/Proxy Module - Implementation & Testing (Completed)

- **Goals:** Implement and test endpoints for the Geth/Proxy,acker, and S,tats modules.

| Step | Task Description                                                                                                                                                                                                                                 | Status |
| :--- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 7.1  | **Geth/Proxy:** Define specific types in `src/utils/types.ts` (e.g., `EthBlockNumberResponse`, `SendRawTxResponse`), implement client methods, create tools, register, test.                                                                     | `[X]`  |
| 7.2  | **Geth/Proxy:** Update `EtherscanClient._request` helper if needed to handle POST requests (especially for `eth_sendRawTransaction`).                                                                                                            | `[X]`  |
| 7.3  | **Geth/Proxy Testing:** Test each Geth/Proxy tool using `mcp run tool`.                                                                                                                                                                          | `[X]`  |
| 7.4  | Document test results/findings for Phase 7. **Findings:** `Geth/Proxy tools` tested successfully via `use_mcp_tool` after server restart. `etherscan_eth_sendRawTransaction` was skipped during testing as it requires a signed transaction hex. | `[X]`  |

## Phase 8: Refinement & Final Testing (Completed)

- **Goals:** Refine codebase, perform final integration tests after all modules are implemented and initially tested.

| Step | Task Description                                                                                                                                                                                                                                               | Status |
| :--- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 8.1  | **Refinement:** Review error handling across all implemented tools for consistency and clarity. (Client throws `EtherscanError`, index handler throws `McpError`).                                                                                             | `[X]`  |
| 8.2  | **Refinement:** Review logging (`console.error`) for usefulness and ensure no sensitive data (API Key) is logged. (Current logging deemed sufficient).                                                                                                         | `[X]`  |
| 8.3  | **Refinement:** Ensure consistent use of TypeScript types and interfaces across all modules. (`types.ts` reviewed, consistent).                                                                                                                                | `[X]`  |
| 8.4  | **Refinement:** Add/Update JSDoc comments to public client methods and tool definitions for clarity. (Added to client methods and all `src/tools/*.ts` files).                                                                                                 | `[X]`  |
| 8.5  | **End-to-End Testing:** Re-test known edge cases, parameter combinations (`chainid`, pagination, sorting), and potential sequences of tool calls across different modules. (Performed via `test/e2e.ts` script).                                               | `[X]`  |
| 8.6  | Document final test results/findings for Phase 8. **Findings:** E2E test script (`test/e2e.ts`) created and executed successfully against the compiled server. All defined test cases passed, validating error handling and core functionality across modules. | `[X]`  |

## Phase 9: Documentation & Release Preparation

- **Goals:** Finalize documentation and prepare the server for usage.

| Step | Task Description                                                                                                                                           | Status |
| :--- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 9.1  | **Documentation:** Update `README.md` with final purpose, features (complete list of implemented tools), setup instructions (API key), and usage examples. | `[X]`  |
| 9.2  | **Documentation:** Add clear configuration/registration instructions to `README.md` (both `mcp install` and manual `settings.json` methods).               | `[X]`  |
| 9.3  | **Documentation:** Review `technical.md` and `overview.md` for accuracy and completeness based on the final implementation.                                | `[X]`  |
| 9.4  | **Code Freeze & Review (Optional):** Conduct a final review of the entire codebase for consistency, clarity, and potential issues.                         | `[X]`  |
| 9.5  | **Build:** Run `npm run build` one last time to ensure clean compilation.                                                                                  | `[X]`  |
| 9.6  | **Tag Release (Optional):** Create a Git tag for the version (e.g., `v1.0.0`).                                                                             | `[ ]`  |

## Risks and Mitigation Strategies

- **Risk:** Etherscan API Rate Limits.
  - **Mitigation:** Implement basic retry logic (with backoff) in `EtherscanClient`. Monitor usage. Inform users of potential limits. Consider adding optional delay parameter in tools if needed.
- **Risk:** Changes in Etherscan API v2.
  - **Mitigation:** Rely on official documentation. Implement robust response validation. Test frequently.
- **Risk:** Complexity in Handling Etherscan API Responses.
  - **Mitigation:** Define clear TypeScript interfaces for expected responses (`src/utils/types.ts`). Implement robust checks within tool handlers before returning data. Test various response scenarios.
- **Risk:** Incomplete or Inconsistent Testing.
  - **Mitigation:** Adhere strictly to the MCP Testing Protocol: _test every tool_. Maintain a checklist of tools, parameters tested (valid, invalid, edge-case), and results. Refer to this checklist before marking a phase complete. Use `mcp run tool` extensively.
- **Risk:** API Key Security and Management.
  - **Mitigation:** Use `.env` for local development. Ensure `.env` is in `.gitignore`. Provide clear instructions in `README.md` for users to manage their key via environment variables (when using `mcp install`) or `settings.json` (when configuring manually). Never commit the key.
