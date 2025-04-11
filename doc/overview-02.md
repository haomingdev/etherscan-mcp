# Etherscan MCP Server Overview (v2 - Agentic Extension)

## Phase 1: Standard Etherscan Tooling (Completed)

_This section summarizes the goals and scope achieved as described in the original `doc/overview.md`._

### 1.1 Goal [Existing]

To create a comprehensive Model Context Protocol (MCP) server that provides easy access to the Etherscan V2 API endpoints. This server allows users to query various Ethereum blockchain data directly through MCP tools.

**Note:** This MCP server itself acts as the bridge between MCP clients (like Claude Desktop) and the Etherscan REST API.

### 1.2 Scope [Existing]

The server covers the following Etherscan API modules via **standard MCP tools**:

- Accounts
- Contracts
- Transactions
- Blocks
- Logs
- Geth/Parity Proxy
- Tokens
- Gas Tracker
- Stats

Key aspects include handling various Etherscan parameters like pagination, sorting, block ranges, and **chain selection (`chainid`)**.

### 1.3 Technology Stack [Existing]

- **Language:** TypeScript
- **Framework:** MCP SDK for TypeScript (`@mcp/server`)
- **API Client (Etherscan):** `axios` (or similar Node.js HTTP client)
- **Schema Validation:** `zod`
- **Environment Variables:** `dotenv`

### 1.4 Authentication [Existing]

- **Etherscan:** Requires a standard Etherscan API Key (`apikey`). Configured via `ETHERSCAN_API_KEY` environment variable.

### 1.5 Implementation Plan [Existing]

1.  **Bootstrap:** Initialize a new TypeScript MCP server project using `npx @modelcontextprotocol/create-server`.
2.  **Core Implementation:**
    - Develop `EtherscanClient.ts` to handle Etherscan API interactions.
    - Implement methods for Etherscan endpoints.
    - Define corresponding MCP tools (`etherscan_*`) with schemas.
    - Implement error handling and logging.
3.  **Configuration:** Set up `settings.json` for server registration, mapping `ETHERSCAN_API_KEY`.
4.  **Testing:** Rigorously test _each standard_ MCP tool individually.
5.  **Documentation:** Add basic usage instructions in `README.md`.

---

## Phase 2: Internal Agentic Capability (New)

_This section outlines the new requirements and goals to extend the server with internal agentic functionality._

### 2.1 Goal [New]

To introduce an **internal agentic capability** within the server. This will be exposed via a new, specific MCP tool (e.g., `etherscan_runAgentTask`). When invoked with a high-level prompt (e.g., "Summarize Vitalik Buterin's recent mainnet activity"), this tool's handler will:

1.  Utilize an external Large Language Model (LLM) to understand the prompt and plan necessary steps.
2.  Internally call existing Etherscan client functions (e.g., `getBalance`, `getNormalTransactions`) within the server to gather required data.
3.  Synthesize the gathered data (potentially using the LLM again) into a coherent response to the original prompt.
4.  Return the final synthesized response to the MCP client.

### 2.2 Scope [New]

- Implement **one agentic MCP tool** (e.g., `etherscan_runAgentTask`) designed to handle complex, multi-step queries by orchestrating internal calls to the standard Etherscan functions implemented in Phase 1.
- Requires integration with an external LLM service.
- Requires handling of LLM API keys.

### 2.3 Technology Stack [New Additions]

- **API Client (LLM):** Google Generative AI SDK (`@google/generative-ai`).

### 2.4 Authentication [New Requirements]

- **LLM:** Requires a Google API key (obtained from Google AI Studio). Configured via the `GOOGLE_API_KEY` environment variable.

### 2.5 Implementation Plan [New Steps]

1.  **Agent Script Development:**
    - Design and implement the "Agent Script" module (`src/agent/agent.ts` or similar).
    - Integrate LLM SDK for prompt understanding, planning, and synthesis.
    - Implement logic to call `EtherscanClient` methods internally based on the LLM's plan.
2.  **Agentic Tool Definition:**
    - Define the agentic MCP tool (`etherscan_runAgentTask`) in `src/tools/agent.ts` (or similar) with an appropriate input schema (e.g., for the prompt).
    - Implement the handler for the agentic tool in [src/index.ts](cci:7://file:///Users/haoming/Documents/Avium%202024/Work%20Docs/etherscan-mcp/src/index.ts:0:0-0:0) to invoke the Agent Script.
    - Add robust error handling for LLM interactions and internal orchestration.
3.  **Configuration Update:** Update `settings.json` / `.env` setup to handle the new LLM API key environment variable.
4.  **Testing [New]:** Rigorously test the _agentic_ MCP tool with various prompts to ensure correct planning, internal execution, and result synthesis.
5.  **Documentation Update [New]:** Update `README.md` and technical docs to reflect the new agentic tool, its usage, and the added LLM API key requirement.

---

## Combined MCP Technical Details (Existing + New)

_This section reflects the overall server considering both phases._

- **Capabilities:** The server primarily exposes functionality via the **`tools`** capability. Both standard Etherscan API wrappers (Phase 1) and the new agentic task handler (Phase 2) are exposed as distinct MCP tools. It will declare only the `tools` capability. `Resources` and `prompts` capabilities remain out of scope.
- **Transport:** Communication defaults to **Standard Input/Output (`stdio`)**.
- **Configuration/Registration:** Users register the server via `mcp install` or manual `settings.json` edits, providing the path and necessary environment variables (now including both `ETHERSCAN_API_KEY` and the LLM API key).
- **Implementation Model (Asynchronous):** All tool handlers, especially the new agentic one involving network calls to both Etherscan and an LLM, **must** be implemented using **`async/await`**.
