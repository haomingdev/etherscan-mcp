# Etherscan MCP Server: Implementation Plan

This document outlines the phased plan for building the Etherscan MCP server.

## Core MCP Concepts for this Server

- **Capabilities:** This server will primarily expose **Tools**. Each Etherscan API endpoint will be mapped to an MCP Tool. The server will declare the `tools` capability upon initialization. We do not plan to implement `resources` or `prompts`.
- **Transport:** The `@mcp/server` SDK handles transport, defaulting to **stdio** for communication with the MCP Host (suitable for local development).
- **Implementation Model:** The implementation will be **asynchronous** (`async/await` in TypeScript) due to network I/O for Etherscan API calls.

## Phase 1: Setup and Foundation (Estimated Duration: 1 Week)

- **Goals:** Establish the project structure, core dependencies, basic API client, and foundational configurations.

| Step | Task Description                                                                                                                                                                         | Status |
| :--- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 1.1  | Run `npx @modelcontextprotocol/create-server .` (Ensure you are *inside* the `etherscan-mcp` directory)                                                                                | `[ ]`  |
| 1.2  | Run `npm install` (or `yarn install`)                                                                                                                                                    | `[ ]`  |
| 1.3  | Initialize Git repository: `git init && git add . && git commit -m "Initial commit from @mcp/create-server"`                                                                             | `[ ]`  |
| 1.4  | Verify expected project structure (src/, dist/, package.json, tsconfig.json, etc.)                                                                                                       | `[ ]`  |
| 1.5  | Install additional dependencies: `npm install axios dotenv`                                                                                                                              | `[ ]`  |
| 1.6  | Create `.env` file in `etherscan-mcp` root with `ETHERSCAN_API_KEY=YOUR_ACTUAL_API_KEY`.                                                                                                 | `[ ]`  |
| 1.7  | Create `.gitignore` in `etherscan-mcp` root; add `node_modules/`, `dist/`, `.env`.                                                                                                       | `[ ]`  |
| 1.8  | Review/adjust `tsconfig.json`, `package.json` scripts (build, dev, start), `.eslintrc.js` (defaults often okay initially).                                                               | `[ ]`  |
| 1.9  | Create `src/utils/client.ts` and define `EtherscanClient` class shell.                                                                                                                   | `[ ]`  |
| 1.10 | Implement `EtherscanClient` constructor (accept `apiKey`, store `baseURL`).                                                                                                              | `[ ]`  |
| 1.11 | Implement initial private `_request` helper in `EtherscanClient` using `axios` (handle GET, append API key, basic error handling/logging).                                               | `[ ]`  |
| 1.12 | Create `src/utils/types.ts` and define initial basic interfaces (e.g., `EtherscanBaseResponse`).                                                                                         | `[ ]`  |
| 1.13 | Create `src/tools/` directory.                                                                                                                                                           | `[ ]`  |
| 1.14 | Create `src/index.ts` - main server entry point.                                                                                                                                         | `[ ]`  |
| 1.15 | Implement basic `src/index.ts`: load `.env`, instantiate `EtherscanClient`, instantiate `Server` from `@mcp/server`, set capabilities (`tools`), add placeholders for tool registration. | `[ ]`  |
| 1.16 | Decide on strategy for handling `chainid` (confirm: parameter in tool inputs).                                                                                                           | `[ ]`  |
| 1.17 | Understand stdio transport is handled by SDK (no explicit setup needed in `index.ts`).                                                                                                   | `[ ]`  |

## Phase 2: Core Modules - Accounts & Transactions (Estimated Duration: 2 Weeks)

- **Goals:** Implement and thoroughly test all endpoints for the Accounts and Transactions modules.

| Step | Task Description                                                                                                                             | Status |
| :--- | :------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 2.1  | **Accounts:** Define specific response interfaces in `src/utils/types.ts` (e.g., `BalanceResponse`, `TxListResponse`).                       | `[X]`  |
| 2.2  | **Accounts:** Implement methods in `EtherscanClient` for `balance`, `balancemulti`, `txlist`, `txlistinternal`, `tokentx`, `getminedblocks`. | `[X]`  |
| 2.3  | **Accounts:** Create `src/tools/accounts.ts`.                                                                                                | `[X]`  |
| 2.4  | **Accounts:** Define MCP tools in `accounts.ts` using `mcp.createTool` for each client method (use Zod `inputSchema`, `async handler`).      | `[X]`  |
| 2.5  | **Accounts:** Register these tools in `src/index.ts` (import definitions, add to `server.capabilities.tools`, implement basic handlers).     | `[X]`  |
| 2.6  | **Accounts Testing:** Use `mcp run tool` (or Inspector) to test *each* account tool (`getBalance`, `getMultiBalance`, `getNormalTransactions`) with valid/invalid addresses and chain IDs. | `[X]`  |
| 2.7  | **Accounts Testing:** Test `etherscan_getInternalTransactions`, `etherscan_getTokenTransfers`, `etherscan_getMinedBlocks` with appropriate parameters.                                 | `[ ]`  |
| 2.8  | Define response/request types in `src/utils/types.ts` for *Transactions* module endpoints (`gettxreceiptstatus`, `getstatus`).                                                            | `[ ]`  |
| 2.9  | **Transactions:** Implement client methods in `EtherscanClient`.                                                                              | `[ ]`  |
| 2.10 | **Transactions:** Create `src/tools/transactions.ts`.                                                                                        | `[ ]`  |
| 2.11 | **Transactions:** Define MCP tools in `transactions.ts` using `mcp.createTool`.                                                              | `[ ]`  |
| 2.12 | **Transactions:** Include `chainid` in tool `inputSchema` where needed.                                                                      | `[ ]`  |
| 2.13 | **Transactions:** Register transaction tools in `src/index.ts`.                                                                              | `[ ]`  |
| 2.14 | **Transactions Testing:** Test _each_ transaction tool using `mcp run tool etherscan.<toolName>` with valid/invalid inputs, `chainid`.       | `[ ]`  |
| 2.15 | Document test results/findings for Phase 2.                                                                                                  | `[ ]`  |

## Phase 3: Core Modules - Contracts, Blocks, Logs (Estimated Duration: 1 Week)

- **Goals:** Implement and test endpoints for Contracts, Blocks, and Logs modules.

| Step | Task Description                                                                                        | Status |
| :--- | :------------------------------------------------------------------------------------------------------ | :----- |
| 3.1  | **Contracts:** Define types in `src/utils/types.ts` (`getabi`, `getsourcecode`).                        | `[ ]`  |
| 3.2  | **Contracts:** Implement client methods in `EtherscanClient`.                                           | `[ ]`  |
| 3.3  | **Contracts:** Create `src/tools/contracts.ts`.                                                         | `[ ]`  |
| 3.4  | **Contracts:** Define MCP tools in `contracts.ts`, register in `index.ts`.                              | `[ ]`  |
| 3.5  | **Contracts Testing:** Test each tool using `mcp run tool`.                                             | `[ ]`  |
| 3.6  | **Blocks:** Define types in `src/utils/types.ts` (`getblockreward`, `getblockcountdown`).               | `[ ]`  |
| 3.7  | **Blocks:** Implement client methods in `EtherscanClient`.                                              | `[ ]`  |
| 3.8  | **Blocks:** Create `src/tools/blocks.ts`.                                                               | `[ ]`  |
| 3.9  | **Blocks:** Define MCP tools in `blocks.ts`, register in `index.ts`.                                    | `[ ]`  |
| 3.10 | **Blocks Testing:** Test each tool using `mcp run tool`.                                                | `[ ]`  |
| 3.11 | **Logs:** Define types in `src/utils/types.ts` (`getLogs`).                                             | `[ ]`  |
| 3.12 | **Logs:** Implement client method in `EtherscanClient`.                                                 | `[ ]`  |
| 3.13 | **Logs:** Create `src/tools/logs.ts`.                                                                   | `[ ]`  |
| 3.14 | **Logs:** Define MCP tool in `logs.ts`, register in `index.ts`.                                         | `[ ]`  |
| 3.15 | **Logs Testing:** Test tool using `mcp run tool`, focusing on different topic/address/block parameters. | `[ ]`  |
| 3.16 | Document test results/findings for Phase 3.                                                             | `[ ]`  |

## Phase 4: Remaining Modules & Refinement (Estimated Duration: 1 Week)

- **Goals:** Implement and test remaining modules (Geth/Proxy, Tokens, Gas Tracker, Stats) and refine the codebase.

| Step | Task Description                                                                                                                            | Status |
| :--- | :------------------------------------------------------------------------------------------------------------------------------------------ | :----- |
| 4.1  | **Geth/Proxy:** Define types, implement client methods (consider POST requests for `eth_sendRawTransaction`), create tools, register, test. | `[ ]`  |
| 4.2  | **Geth/Proxy:** Update `EtherscanClient._request` helper if needed to handle POST requests.                                                 | `[ ]`  |
| 4.3  | **Tokens:** Define types, implement client methods, create tools, register, test.                                                           | `[ ]`  |
| 4.4  | **Gas Tracker:** Define types, implement client methods, create tools, register, test.                                                      | `[ ]`  |
| 4.5  | **Stats:** Define types, implement client methods, create tools, register, test.                                                            | `[ ]`  |
| 4.6  | **Refinement:** Review error handling across all tools for consistency and clarity.                                                         | `[ ]`  |
| 4.7  | **Refinement:** Review logging (`console.error`) for usefulness and ensure no sensitive data (API Key) is logged.                           | `[ ]`  |
| 4.8  | **Refinement:** Ensure consistent use of TypeScript types and interfaces.                                                                   | `[ ]`  |
| 4.9  | **Refinement:** Add JSDoc comments to public client methods and tool definitions for clarity.                                               | `[ ]`  |
| 4.10 | Document test results/findings for Phase 4.                                                                                                 | `[ ]`  |

## Phase 5: Final Testing, Documentation & Configuration (Estimated Duration: 1 Week)

- **Goals:** Complete comprehensive testing, finalize documentation, and prepare for usage.

| Step | Task Description                                                                                                                                  | Status |
| :--- | :------------------------------------------------------------------------------------------------------------------------------------------------ | :----- |
| 5.1  | **End-to-End Testing:** Re-test known edge cases, parameter combinations (`chainid`, pagination, sorting), and potential sequences of tool calls. | `[ ]`  |
| 5.2  | **Documentation:** Update `README.md` with final purpose, features (list of tools), setup instructions (API key), and usage examples.             | `[ ]`  |
| 5.3  | **Documentation:** Add clear configuration/registration instructions to `README.md` (both `mcp install` and manual `settings.json` methods).      | `[ ]`  |
| 5.4  | **Documentation:** Review `technical.md` and `overview.md` for accuracy and completeness based on the final implementation.                       | `[ ]`  |
| 5.5  | **Code Freeze & Review (Optional):** Conduct a final review of the entire codebase for consistency, clarity, and potential issues.                | `[ ]`  |
| 5.6  | **Build:** Run `npm run build` one last time to ensure clean compilation.                                                                         | `[ ]`  |
| 5.7  | **Tag Release (Optional):** Create a Git tag for the version (e.g., `v1.0.0`).                                                                    | `[ ]`  |

## Risks and Mitigation Strategies

{{ ... }} 3. **Risk:** Complexity in Handling Etherscan API Responses. - **Mitigation:** Define clear TypeScript interfaces for expected responses (`src/utils/types.ts`). Implement robust checks within tool handlers before returning data. Test various response scenarios. 4. **Risk:** Incomplete or Inconsistent Testing. - **Mitigation:** Adhere strictly to the MCP Testing Protocol: _test every tool_. Maintain a checklist of tools, parameters tested (valid, invalid, edge-case), and results. Refer to this checklist before marking a phase complete. 5. **Risk:** API Key Security and Management. - **Mitigation:** Use `.env` for local development. Ensure `.env` is in `.gitignore`. Provide clear instructions in `README.md` for users to manage their key via environment variables (when using `mcp install`) or `settings.json` (when configuring manually). Never commit the key.

## Next Steps

| Step | Task Description                                                                                | Status |
| :--- | :---------------------------------------------------------------------------------------------- | :----- |
| 1    | Review and approve this updated Implementation Plan.                                            | `[ ]`  |
| 2    | Begin Phase 1, starting with Step 1.1 (Bootstrap Project). Use `run_command` where appropriate. | `[ ]`  |
| 3    | Proceed sequentially through the tasks, marking checkboxes as steps are completed.              | `[ ]`  |
| 4    | Confirm each phase is complete (all checkboxes ticked) before moving to the next phase.         | `[ ]`  |

## Async Example

{{ ... }}

## Detailed Config

- Build: Run `npm run build` and ensure a clean, error-free compilation to the `dist` directory.
  {{ ... }}
