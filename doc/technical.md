# Etherscan MCP Server: Technical Specification

**Version:** 1.0 (Initial Draft)

## Section 1: Introduction

### 1.1 Purpose

This document provides the technical specification for the Etherscan Model Context Protocol (MCP) Server. The server acts as a bridge, enabling MCP clients (such as AI models running within host applications like Claude Desktop) to interact with the Etherscan V2 API in a structured and approved manner. It aims to provide reliable access to Ethereum blockchain data by exposing various Etherscan endpoints as MCP tools.

### 1.2 Scope

**In Scope:**

- Implementation of an MCP server using TypeScript and the `@mcp/server` SDK.
- Wrapping key Etherscan V2 API endpoints (Accounts, Contracts, Transactions, Blocks, Logs, Gas Tracker, Tokens, Stats, Geth/Proxy) as individual MCP tools.
- Handling Etherscan API key authentication via environment variables.
- Supporting chain selection (`chainid`) as a common parameter for relevant tools.
- Basic error handling and mapping of Etherscan API responses/errors.
- Comprehensive logging for requests, responses, and errors within the server.
- Adherence to the MCP Server Development Protocol, including rigorous testing.
- Configuration instructions for running the server via `mcp install` or manual `settings.json`.

**Out of Scope:**

- Implementing MCP `resources` or `prompts` capabilities.
- Providing a user interface (it's a backend server).
- Caching Etherscan API responses.
- Complex rate limiting beyond what Etherscan enforces (initially).
- Supporting Etherscan API endpoints not listed in the V2 documentation.
- Advanced blockchain data analysis or transformation within the server.
- Direct interaction with blockchain nodes (relies solely on Etherscan API).

### 1.3 Audience

- Developers building and maintaining the Etherscan MCP server.
- Technical leads overseeing the project.
- Potentially QA engineers involved in testing the server's tools.

### 1.4 References

- [Etherscan V2 API Documentation: Accounts](https://docs.etherscan.io/api-endpoints/accounts)
- [Etherscan V2 API Documentation: Contracts](https://docs.etherscan.io/api-endpoints/contracts)
- [Etherscan V2 API Documentation: Transactions](https://docs.etherscan.io/api-endpoints/stats)
- [Etherscan V2 API Documentation: Blocks](https://docs.etherscan.io/api-endpoints/blocks)
- [Etherscan V2 API Documentation: Logs](https://docs.etherscan.io/api-endpoints/logs)
- [Etherscan V2 API Documentation: Gas Tracker](https://docs.etherscan.io/api-endpoints/gas-tracker)
- [Etherscan V2 API Documentation: Tokens](https://docs.etherscan.io/api-endpoints/tokens)
- [Etherscan V2 API Documentation: Stats](https://docs.etherscan.io/api-endpoints/stats-1)
- [Etherscan V2 API Documentation: Geth/Proxy](https://docs.etherscan.io/api-endpoints/geth-parity-proxy)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/docs/spec)
- [MCP SDK for TypeScript (`@mcp/server`)](https://github.com/modelcontextprotocol/typescript-sdk) (or relevant link if available)
- Etherscan MCP Server [Overview.md](./overview.md)
- Etherscan MCP Server [Implementation.md](./implementation.md)

### 1.5 Glossary/Definitions

- **MCP:** Model Context Protocol. A protocol enabling communication between AI models/host applications and external tools/services.
- **MCP Server:** An application implementing the MCP protocol to expose capabilities (like tools).
- **MCP Client/Host:** An application (e.g., Claude Desktop) that connects to and interacts with MCP Servers.
- **Tool:** An MCP capability representing an executable function with defined inputs and outputs.
- **stdio:** Standard Input/Output. The default communication transport for local MCP servers.
- **Chain ID:** Numerical identifier for different Ethereum-compatible blockchains (e.g., 1 for Mainnet, 11155111 for Sepolia).

## Section 2: System Architecture & Design

### 2.1 High-Level Overview

The Etherscan MCP Server is a standalone Node.js process designed to run locally alongside an MCP client host. It communicates with the host application via the MCP protocol over a specified transport (defaulting to `stdio`). Its primary function is to receive tool execution requests from the host, translate them into corresponding Etherscan V2 API HTTP requests, process the responses, and return the results (or errors) back to the host according to the MCP specification.

**Architecture Diagram (Conceptual):**

```mermaid
graph LR
    User --> Host[MCP Client Host (e.g., Claude Desktop)];
    Host <-. MCP Protocol (stdio) .-> MCPServer[Etherscan MCP Server (Node.js)];
    MCPServer -- HTTPS Request --> Etherscan[Etherscan V2 API];
    MCPServer <-- HTTPS Response -- Etherscan;
    subgraph MCPServer Internal
        direction LR
        SDK[@mcp/server SDK] -- Dispatches --> ToolHandler[Tool Handler (e.g., getBalance)];
        ToolHandler -- Uses --> Client[EtherscanClient];
        Client -- Uses --> Axios[axios];
    end
    Host -- Displays --> User;
```

### 2.2 Key Components/Modules

- **MCP Server Runtime (`@mcp/server` SDK):** Manages the MCP protocol handshake, message parsing/serialization, tool discovery (`listTools`), tool invocation (`callTool`), input/output validation (via Zod schemas), and transport handling (`stdio`).
- **Main Server Entry Point (`src/index.ts`):** Initializes the MCP Server instance, loads environment variables (`dotenv`), instantiates the `EtherscanClient`, registers all defined tools with the SDK, and starts the server run loop.
- **Tool Definitions (`src/tools/*.ts`):** Separate files defining each MCP tool using `mcp.createTool`. Each definition includes the tool's `name`, `description`, `inputSchema` (using Zod for validation), and the asynchronous `handler` function containing the core logic.
- **Etherscan API Client (`src/utils/client.ts`):** A custom `EtherscanClient` class encapsulating the logic for interacting with the Etherscan API. It holds the API key, constructs request URLs, uses `axios` to make HTTP requests, and performs initial response validation/error mapping.
- **HTTP Request Library (`axios`):** Used by `EtherscanClient` to perform the actual HTTP GET/POST requests to the Etherscan API.
- **Utilities (`src/utils/*.ts`):** May include shared TypeScript types/interfaces (`types.ts`), custom error classes (`errors.ts`), and potentially constants (`constants.ts`).

### 2.3 Design Choices & Rationale

- **Node.js & TypeScript:** Chosen for alignment with the primary MCP SDK and strong typing benefits, improving maintainability and reducing runtime errors.
- **`@mcp/server` SDK:** Leveraged to handle the complexities of the MCP protocol, allowing focus on the Etherscan integration logic.
- **Zod Schemas:** Used for defining `inputSchema` (and potentially `outputSchema`) for tools, providing robust runtime validation and type safety.
- **Centralized `EtherscanClient`:** Encapsulates API interaction logic, promoting code reuse and making it easier to manage the API key, base URL, and common request patterns.
- **Asynchronous Handlers:** All tool handlers must be `async` because they perform network I/O, preventing the Node.js event loop from being blocked.
- **Environment Variables for API Key:** Standard practice for securely managing secrets, avoiding hardcoding.
- **stdio Transport:** Default and simplest transport for local server execution, suitable for the primary use case with desktop clients.

### 2.4 Technology Stack Summary

- **Language:** TypeScript (~5.x)
- **Runtime:** Node.js (LTS version, e.g., >= 18.x)
- **MCP Framework:** `@mcp/server` (latest compatible version)
- **Schema Validation:** `zod`
- **HTTP Client:** `axios`
- **Environment Variables:** `dotenv`

## Section 3: Component/Module Specifications

### 3.1 EtherscanClient (`src/utils/client.ts`)

- **Responsibilities:**
  - Store the Etherscan API key and base URL.
  - Provide methods corresponding to logical Etherscan operations (e.g., `getBalance`, `getTransactions`).
  - Construct correct Etherscan API request URLs, including the API key and necessary query parameters.
  - Execute HTTP requests using `axios`.
  - Perform basic validation of Etherscan API responses (checking `status`, `message`, `result`).
  - Map Etherscan-specific errors (e.g., invalid address, rate limit) to custom error types or standard `Error` objects.
  - Handle different HTTP methods if needed (initially GET, potentially POST later).
  - Include the `chainid` parameter in requests where applicable.
- **Internal Design:**
  - Constructor accepts `apiKey`.
  - Private `_request` helper method to encapsulate `axios` call, common parameter handling (like `apikey`, `chainid`), response checking, and error mapping.
  - Public methods (e.g., `async getBalance(params: { address: string, chainid: number }): Promise<EtherscanBalanceResponse>`) that call `_request`.
- **Dependencies:** `axios`, custom Types/Interfaces (`src/utils/types.ts`), potentially custom Errors (`src/utils/errors.ts`).
- **Interfaces/APIs (Internal):** Called by the MCP tool handlers defined in `src/tools/*.ts`.

### 3.2 Tool Handlers (`src/tools/*.ts`)

- **Responsibilities:**
  - Define the MCP tool metadata (`name`, `description`, `inputSchema`).
  - Receive validated input parameters from the MCP SDK.
  - Log the incoming request details.
  - Call the appropriate method(s) on the `EtherscanClient` instance, passing necessary parameters (including `chainid`).
  - Process the result from `EtherscanClient` if necessary.
  - Log the successful result or any errors encountered.
  - Return the result in the format expected by MCP (or throw an error).
- **Internal Design:** Each handler is an `async` function adhering to the structure required by `mcp.createTool`. Uses `try...catch` blocks for error handling.
- **Dependencies:** `@mcp/server`, `zod`, `EtherscanClient`, shared Types/Interfaces/Constants.
- **Interfaces/APIs (Internal):** Called by the `@mcp/server` SDK when a `tools/call` request is received for that specific tool.

## Section 4: API / Interface Specifications (MCP Tool Interface)

### 4.1 External Interfaces Overview

The primary external interface is the Model Context Protocol itself, exposed via the configured transport (default: `stdio`). Clients interact via standard MCP messages:

- **Initialization Handshake:** Standard MCP client/server initialization.
- **`tools/list`:** Client requests the list of available tools.
- **`tools/call`:** Client requests the execution of a specific tool with arguments.
- **`logging` Notifications:** Server sends log messages back to the client.

### 4.2 Data Formats / Models (Tool Definitions)

Each tool exposed by the server adheres to the MCP Tool definition structure:

```typescript
{
  name: string; // Unique tool name (e.g., "etherscan.getBalance")
  description: string; // User-friendly description
  inputSchema: ZodSchema; // Zod schema defining expected input parameters
  // outputSchema?: ZodSchema; // Optional: Zod schema for validating output
  handler: (input: z.infer<typeof inputSchema>) => Promise<any>; // Async function
}
```

Common input parameters like `chainid: number` will be included in the `inputSchema` for most tools.

### 4.3 Endpoint/Method Definitions (Conceptual MCP Interactions)

- **Capability Declaration:**

  - **Description:** Server declares it supports the `tools` capability during initialization.
  - **Payload Example:** `{"capabilities": {"tools": {"listChanged": false}}}`

- **`tools/list` Request:**

  - **Description:** Client asks the server for its available tools.
  - **Request:** Standard MCP `tools/list` request frame.
  - **Response (Success):** MCP frame containing `{"tools": [ToolDefinition1, ToolDefinition2, ...]}` where each `ToolDefinition` matches the structure in 4.2 (but typically represented as JSON Schema for `inputSchema`).
  - **Response (Error):** Standard MCP error frame.

- **`tools/call` Request:**
  - **Description:** Client asks the server to execute a specific tool.
  - **Request:** MCP frame containing `{"name": "tool_name", "arguments": {arg1: value1, ...}}`. Arguments must conform to the tool's `inputSchema`.
  - **Response (Success):** MCP frame containing the result returned by the tool's handler (e.g., `{"content": [{"type": "text", "text": "Result details..."}]}` or often structured data).
  - **Response (Error):** Standard MCP error frame if the tool name is not found, input validation fails, or the handler throws an error.
  - **Authentication/Authorization:** Tool execution permission is managed by the MCP Client Host (requiring user approval by default).

## Section 5: Data Management

### 5.1 Data Model / Schema

This server is stateless and does not manage its own persistent data store. Data models are primarily transient, defined by:

- Input/Output schemas of the MCP tools (defined using Zod).
- Request/Response structures of the Etherscan API (defined implicitly by their documentation and handled via TypeScript interfaces in `src/utils/types.ts`).

### 5.2 Data Flow

1.  **Client -> Host:** User triggers action requiring Etherscan data.
2.  **Host -> Server (`tools/call`):** Host sends MCP request to execute a specific tool with parameters.
3.  **Server (SDK):** Parses request, validates input against tool's Zod schema.
4.  **Server (Handler):** Calls `EtherscanClient` method.
5.  **Server (`EtherscanClient`):** Constructs URL, adds API key.
6.  **Server (`axios`) -> Etherscan API:** Sends HTTPS request.
7.  **Etherscan API -> Server (`axios`):** Returns HTTPS response (JSON).
8.  **Server (`EtherscanClient`):** Parses response, basic validation.
9.  **Server (Handler):** Receives result/error from client.
10. **Server (SDK):** Serializes successful result or error into MCP response frame.
11. **Server -> Host:** Sends MCP response frame.
12. **Host -> Client:** Displays result/error to user.

### 5.3 Data Persistence & Storage

N/A - Server is stateless.

### 5.4 Data Migration/Seeding

N/A.

## Section 6: Implementation Details

### 6.1 Detailed Technology Stack

- **Node.js:** >= 18.x (LTS)
- **TypeScript:** >= 5.x
- **MCP SDK:** `@mcp/server` (latest)
- **Schema Validation:** `zod` (latest)
- **HTTP Client:** `axios` (latest)
- **Environment:** `dotenv` (latest)
- **Package Manager:** `npm` or `yarn`

### 6.2 Code Structure / Project Layout

```
etherscan-mcp/
├── node_modules/
├── src/
│   ├── index.ts       # Main entry point, server setup, tool registration
│   ├── tools/         # Tool definitions (e.g., accounts.ts, contracts.ts)
│   │   └── index.ts   # Optional: Export all tools from this directory
│   └── utils/         # Utility modules
│       ├── client.ts    # EtherscanClient class
│       ├── types.ts     # Shared TypeScript interfaces/types
│       ├── errors.ts    # Optional: Custom error classes
│       └── constants.ts # Optional: Shared constants
├── dist/            # Compiled JavaScript output (from tsc)
├── .env.example     # Example environment variables
├── .env             # Actual environment variables (GITIGNORED)
├── .gitignore
├── package.json
├── README.md
└── tsconfig.json
```

### 6.3 Coding Standards & Conventions

- Follow standard TypeScript best practices.
- Use ESLint and Prettier (configured by `create-server` template) for code style and linting.
- Adhere to naming conventions (e.g., PascalCase for classes/types, camelCase for functions/variables).
- Use clear, descriptive names for variables, functions, classes, and tools.
- Add TSDoc comments for public functions, classes, and complex logic.

### 6.4 Error Handling Strategy

- Use `try...catch` blocks within tool handlers and `EtherscanClient` methods.
- `EtherscanClient` validates responses and throws specific (or standard `Error`) errors on API issues (bad status, error messages in response).
- Tool handlers catch errors from `EtherscanClient`, log them, and re-throw standard `Error` objects with user-friendly messages for the MCP client.
- The `@mcp/server` SDK handles input validation errors automatically based on Zod schemas.
- Unhandled exceptions will crash the server process (standard Node.js behavior unless a global handler is added, which is not planned initially).

### 6.5 Logging Framework & Strategy

- **Framework:** Standard Node.js `console.error` (directed to stderr, which MCP hosts typically capture).
- **Levels:** Use prefixes like `[Info]`, `[Warn]`, `[Error]` or rely on `console.info`, `console.warn`, `console.error`.
- **Format:** Simple text messages including context (e.g., `[Tool:getBalance] Request received for address X`, `[EtherscanClient] API Error: Invalid Address`).
- **Key Events to Log:**
  - Server startup and initialization.
  - Tool call requests (with sanitized parameters if necessary).
  - Requests made to the Etherscan API (URL, method).
  - Successful responses from Etherscan API (key details).
  - Errors from Etherscan API.
  - Errors caught within handlers or client.
  - Successful tool execution completion.

## Section 7: Security Considerations

### 7.1 Authentication & Authorization

- **Server Authentication:** N/A (Server authenticates to Etherscan, not the other way around).
- **Etherscan API Authentication:** Uses an API key provided via the `ETHERSCAN_API_KEY` environment variable. This key is added to every request by the `EtherscanClient`.
- **MCP Tool Authorization:** Handled by the MCP Client Host. By default, users must approve each tool invocation. Auto-approval can be configured in the host's `settings.json` but should be used cautiously.

### 7.2 Data Security

- **API Key:** Sensitive, managed via environment variables and `.gitignore`.
- **Data in Transit:** Communication between the server and Etherscan API uses HTTPS. Communication between the server and a local MCP host via `stdio` is typically unencrypted but confined to the local machine.
- **PII:** Blockchain addresses, while public, might be considered sensitive in context. Avoid logging excessive request/response data containing addresses unless necessary for debugging.

### 7.3 Input Validation & Sanitization

- Primary input validation is handled by the `@mcp/server` SDK using the Zod schemas defined for each tool's `inputSchema`. This prevents malformed requests from reaching the core logic.
- Parameters (like addresses, block numbers) are passed to Etherscan API as-is after type validation; Etherscan performs its own validation.

### 7.4 Credential Management

- The only credential is the `ETHERSCAN_API_KEY`.
- Store securely using environment variables (loaded via `.env` file locally or configured in the deployment/host environment).
- Ensure `.env` file is in `.gitignore`.

### (Optional) 7.5 Threat Model

- **API Key Leakage:** Mitigation: Use environment variables, `.gitignore`, secure host configuration.
- **Denial of Service (DoS) via Tool Calls:** Mitigation: User approval required by host, potential Etherscan rate limiting.
- **Malformed Input:** Mitigation: Zod schema validation by SDK.
- **Etherscan API Issues:** Mitigation: Error handling, logging.

## Section 8: Performance & Scalability

### 8.1 Performance Requirements

- Tool execution time is primarily dependent on the Etherscan API response time.
- The server itself should add minimal overhead (<100ms typically) per request.
- No specific high-throughput requirements defined, as usage is tied to individual user interactions via the MCP host.

### 8.2 Scalability Strategy

- The server is designed as a single, stateless process. Scalability is limited by:
  - The single Node.js process event loop.
  - Etherscan API rate limits associated with the used API key.
- Not designed for high-concurrency scenarios. Scaling would involve running multiple instances, potentially requiring different API keys if rate limits are hit, which is outside the current scope.

### 8.3 Resource Utilization

- Expected to be low (typical Node.js process memory/CPU usage) as it's primarily I/O bound (waiting for Etherscan API).

## Section 9: Testing Strategy

### 9.1 Testing Levels

- **MCP Tool Testing (Manual/CLI - CRITICAL):** Use `mcp run tool <server_id>.<tool_name> '{ "param": "value" }'` extensively for _each_ tool. Test valid inputs, edge cases, invalid inputs (rejected by Zod), different `chainid` values, and verify outputs against Etherscan documentation/website. This is the primary acceptance testing method mandated by the MCP Development Protocol.
- **Unit Testing (Optional but Recommended):** Use a framework like Jest or Vitest to test the logic within `EtherscanClient` methods (mocking `axios`) and potentially utility functions.
- **Integration Testing (Optional):** Could involve tests that spin up the server and use an MCP client library (like `@mcp/client`) to make actual `tools/call` requests, potentially hitting a staging/testnet Etherscan endpoint if available (or using recorded responses).

### 9.2 Test Environments

- **Local Development:** Using `mcp run server` and `mcp run tool`.
- **CI Environment:** Could run unit tests and potentially CLI tool tests.

### 9.3 Test Data Management

- Use known valid/invalid addresses, transaction hashes, etc., on supported testnets (e.g., Sepolia) and mainnet for manual/CLI testing.
- Mock data for unit tests.

### 9.4 Metrics/Coverage

- Aim for high test coverage for `EtherscanClient` if unit tests are implemented.
- Primary success metric is successful validation of all tools via `mcp run tool` against expected Etherscan results.

## Section 10: Deployment & Operations

### 10.1 Deployment Process

- **Build:** Run `npm run build` (which executes `tsc`) to compile TypeScript to JavaScript in the `dist/` directory.
- **Packaging:** The deployment artifact is the content of the `dist/` directory plus `package.json`, `node_modules` (or `npm install --production` in the target environment).
- **Registration:** The server needs to be registered with the MCP host environment:
  - **CLI:** `mcp install ./dist/index.js -n etherscan -e ETHERSCAN_API_KEY=...`
  - **Manual:** Editing the host's `settings.json` as detailed in `implementation.md`.
- **CI/CD:** Not explicitly defined, but could automate build, testing, and potentially packaging.

### 10.2 Infrastructure Requirements

- A machine with Node.js (LTS) installed where the MCP Client Host runs.
- Network access to `https://api.etherscan.io`.

### 10.3 Configuration Management

- `ETHERSCAN_API_KEY`: Via `.env` file or host's `settings.json` environment variables.
- `NODE_ENV`: Typically set to `production` when running via `settings.json`.
- Other configurations (base URL) are currently hardcoded but could be made configurable if needed.

### 10.4 Monitoring & Alerting

- **Monitoring:** Primarily via logs captured by the MCP host from the server's stderr output.
- **Alerting:** N/A for the server itself. The MCP host might implement alerting based on server crashes or repeated tool failures.

### 10.5 Maintenance & Updates

- Update dependencies (`npm update`).
- Rebuild and re-register the server after updates.
- Rollback involves registering the previous working build.

## Section 11: Future Considerations / Roadmap

### 11.1 Planned Enhancements

- Implement remaining Etherscan V2 modules/endpoints as tools.
- Support for Etherscan API POST requests (for Geth/Proxy module).
- More granular error mapping from Etherscan errors.
- Optional `outputSchema` validation for tools.
- Potential caching layer (if performance becomes an issue).

### 11.2 Potential Issues / Open Questions

- Handling Etherscan API rate limits gracefully.
- Discovering the exact error messages/codes returned by Etherscan for various failure scenarios.
- Ensuring consistent `chainid` handling across all tools.

### 11.3 Scalability Roadmap

- Not applicable for the current single-user, local execution model.

## Section 12: Appendices (Optional)

_(Placeholder for detailed tool schemas, complex diagrams, etc., if needed later)_

## Appendix C: Code Examples

These snippets illustrate the core implementation patterns for the Etherscan MCP Server using TypeScript and the `@mcp/server` SDK.

### C.1 Basic Server Initialization (`src/index.ts` Snippet)

```typescript
import { Server } from "@mcp/server";
import dotenv from "dotenv";
import { EtherscanClient } from "./utils/client"; // Assuming EtherscanClient is in utils
// Import defined tools
import { getBalanceTool } from "./tools/accounts";
// ... import other tools

// Load environment variables from .env file
dotenv.config();

async function main() {
  // Retrieve API key securely
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    console.error("FATAL: ETHERSCAN_API_KEY environment variable not set.");
    process.exit(1);
  }

  console.error("[Setup] Initializing Etherscan MCP Server...");

  // Instantiate the Etherscan API client
  const etherscanClient = new EtherscanClient(apiKey);

  // Create the MCP Server instance
  // The server ID 'etherscan' should match configuration in settings.json or mcp install
  const mcp = new Server({
    name: "etherscan-mcp", // Informational name
    id: "etherscan", // Critical ID for MCP routing
    version: "1.0.0",
  });

  // Declare server capabilities
  mcp.setCapabilities({
    tools: { listChanged: false }, // Declaring tool capability
    // resources: {}, // Not implementing resources
    // prompts: {},   // Not implementing prompts
  });

  // Register tools with the MCP server
  // Pass the etherscanClient instance to tools if they need it directly
  // (Alternatively, tools could import a singleton instance)
  mcp.registerTool(getBalanceTool(etherscanClient));
  // ... mcp.registerTool(getTransactionsTool(etherscanClient));
  // ... etc.

  console.error("[Setup] Tools registered. Starting server run loop...");

  // Start the server's main run loop.
  // The SDK handles transport (e.g., stdio) automatically based on how it's launched.
  await mcp.run();

  console.error("[Shutdown] Server run loop finished.");
}

main().catch((error) => {
  console.error("Unhandled error during server execution:", error);
  process.exit(1);
});
```

### C.2 Example Tool Implementation (`src/tools/accounts.ts` Snippet)

```typescript
import { mcp, McpTool } from "@mcp/server";
import { z } from "zod";
import { EtherscanClient, EtherscanError } from "../utils/client"; // Assuming client and custom error
import { EtherscanBalanceResponse } from "../utils/types"; // Assuming types definition

// Define the input schema using Zod for validation
const GetBalanceInputSchema = z.object({
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"),
  chainid: z.number().int().positive("Chain ID must be a positive integer"),
});

// Define the tool using mcp.createTool
// This function might take the client as an argument if not using singletons
export function getBalanceTool(etherscanClient: EtherscanClient): McpTool {
  return mcp.createTool({
    name: "getBalance", // Tool name used in MCP calls (e.g., etherscan.getBalance)
    description:
      "Get the ETH balance for a single address on a specific chain.",
    inputSchema: GetBalanceInputSchema,
    // outputSchema: z.object({ balance: z.string(), chain: z.number() }), // Optional output validation

    // The handler function MUST be async as it performs network I/O
    async handler(input) {
      // Input is already validated against GetBalanceInputSchema by the SDK
      console.error(
        `[Tool:getBalance] Request for address: ${input.address}, chain: ${input.chainid}`
      );

      try {
        // Await the call to the EtherscanClient method
        const result: EtherscanBalanceResponse =
          await etherscanClient.getBalance({
            address: input.address,
            chainid: input.chainid,
          });

        // Basic check on the result structure (could be more robust)
        if (result.status !== "1") {
          console.error(
            `[Tool:getBalance] Etherscan API Error: ${result.message} - Result: ${result.result}`
          );
          throw new Error(
            `Etherscan API Error: ${result.message || "Unknown error"}`
          );
        }

        console.error(`[Tool:getBalance] Success - Balance: ${result.result}`);
        // Return data matching outputSchema if defined, or the direct relevant result
        // MCP framework will wrap this in the appropriate response structure
        return {
          type: "etherscan_balance", // Example custom type for clarity
          balance: result.result,
          address: input.address,
          chain: input.chainid,
        };
      } catch (error) {
        console.error("[Tool:getBalance] Error executing tool:", error);
        // Re-throw errors so the MCP framework can send an error response
        if (error instanceof EtherscanError) {
          // Custom error from client
          throw new Error(`Etherscan Client Error: ${error.message}`);
        } else if (error instanceof Error) {
          throw new Error(`Execution Error: ${error.message}`); // Keep original message
        } else {
          throw new Error(
            "An unexpected error occurred while fetching the balance."
          );
        }
      }
    },
  });
}
```

### C.3 EtherscanClient Snippet (`src/utils/client.ts` Snippet)

```typescript
import axios, { AxiosInstance, AxiosError } from "axios";
import { EtherscanBalanceResponse, EtherscanBaseResponse } from "./types"; // Assuming types definition

// Optional: Define a custom error class
export class EtherscanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EtherscanError";
  }
}

export class EtherscanClient {
  private readonly apiKey: string;
  private readonly axiosInstance: AxiosInstance;
  private readonly baseUrl: string = "https://api.etherscan.io/v2/api"; // Base URL for v2

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Etherscan API key is required.");
    }
    this.apiKey = apiKey;
    this.axiosInstance = axios.create({
      timeout: 15000, // Example timeout
    });
    console.error("[EtherscanClient] Initialized.");
  }

  // Example public method for a specific API action
  async getBalance(params: {
    address: string;
    chainid: number;
  }): Promise<EtherscanBalanceResponse> {
    console.error(
      `[EtherscanClient:getBalance] Fetching for address ${params.address} on chain ${params.chainid}`
    );
    return this._request<EtherscanBalanceResponse>({
      module: "account",
      action: "balance",
      address: params.address,
      tag: "latest",
      chainid: params.chainid,
    });
  }

  // ... other public methods like getTransactions, getContractAbi etc.

  // Simplified private helper method for making requests
  private async _request<T extends EtherscanBaseResponse>(
    queryParams: Record<string, string | number>
  ): Promise<T> {
    // Add the API key to all requests
    const paramsWithKey = { ...queryParams, apikey: this.apiKey };

    const requestUrl = this.baseUrl;
    console.error(
      `[EtherscanClient:_request] Making GET request to ${requestUrl} with params:`,
      Object.keys(paramsWithKey)
    ); // Log keys, not values (API key)

    try {
      const response = await this.axiosInstance.get<T>(requestUrl, {
        params: paramsWithKey,
        headers: {
          Accept: "application/json",
        },
      });

      // Basic validation (more checks might be needed)
      if (response.status !== 200) {
        throw new EtherscanError(
          `HTTP Error: ${response.status} ${response.statusText}`
        );
      }
      if (!response.data || typeof response.data !== "object") {
        throw new EtherscanError("Invalid response format from Etherscan API");
      }

      // Etherscan specific status check (status '0' means API error)
      if (response.data.status === "0") {
        console.warn(
          `[EtherscanClient:_request] API returned error status: ${response.data.message}, Result: ${response.data.result}`
        );
        // Return the error response structure for the handler to process
        // Or throw a specific error: throw new EtherscanError(response.data.message || 'Etherscan API Error');
        return response.data; // Let handler decide based on status='0'
      }

      console.error(
        `[EtherscanClient:_request] Request successful (status ${response.data.status})`
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          "[EtherscanClient:_request] Axios Error:",
          error.message,
          error.response?.status
        );
        throw new EtherscanError(`Network or Request Error: ${error.message}`);
      } else {
        console.error(
          "[EtherscanClient:_request] Unknown Error during request:",
          error
        );
        throw new EtherscanError(
          `Unexpected Request Error: ${
            error instanceof Error ? error.message : "Unknown"
          }`
        );
      }
    }
  }
}
```
