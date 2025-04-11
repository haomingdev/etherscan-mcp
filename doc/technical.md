# Etherscan MCP Server: Technical Specification

**Version:** 1.0 (Initial Draft)

## Section 1: Introduction

### 1.1 Purpose

This document provides the technical specification for the Etherscan Model Context Protocol (MCP) Server. The server acts as a bridge, enabling MCP clients (such as AI models running within host applications like Claude Desktop) to interact with the Etherscan V2 API in a structured and approved manner. It aims to provide reliable access to Ethereum blockchain data by exposing various Etherscan endpoints as MCP tools.

### 1.2 Scope

**In Scope:**

- Implementation of an MCP server using TypeScript and the `@mcp/server` SDK.
- Wrapping key Etherscan V2 API endpoints (Accounts, Contracts, Transactions, Blocks, Logs, Gas Tracker, Tokens, Stats, Geth/Proxy) as individual MCP tools.
- **(New)** Implementing an internal agentic capability using Google Gemini to handle complex, multi-step queries via a dedicated `etherscan_runAgentTask` tool.
- Handling Etherscan API key authentication via environment variables.
- **(New)** Handling Google API Key authentication via environment variables for the agent.
- Supporting chain selection (`chainid`) as a common parameter for relevant tools.
- Error handling using `EtherscanError` and `McpError` for consistent reporting.
- Comprehensive logging (`console.error`) for requests, responses, and errors within the server.
- Adherence to the MCP Server Development Protocol, including E2E testing via a dedicated script (`test/e2e.ts`).
- Configuration instructions for running the server via manual host settings (`settings.json` or similar).
- **(New)** Defining a new MCP tool (`etherscan_runAgentTask`) to expose this agentic capability.

**Out of Scope:**

- Implementing MCP `resources` or `prompts` capabilities.
- Providing a user interface (it's a backend server).
- Caching Etherscan API responses.
- Complex rate limiting beyond what Etherscan enforces (initially).
- Supporting Etherscan API endpoints not listed in the V2 documentation.
- Advanced blockchain data analysis or transformation within the server **(except as orchestrated by the internal agent)**.
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
- **(New)** [Google Generative AI SDK for Node.js](https://github.com/google-gemini/generative-ai-js)
- **(New)** `src/agent/agent.ts` (Contains agent logic)

### 1.5 Glossary/Definitions

- **MCP:** Model Context Protocol. A protocol enabling communication between AI models/host applications and external tools/services.
- **MCP Server:** An application implementing the MCP protocol to expose capabilities (like tools).
- **MCP Client/Host:** An application (e.g., Claude Desktop) that connects to and interacts with MCP Servers.
- **Tool:** An MCP capability representing an executable function with defined inputs and outputs.
- **stdio:** Standard Input/Output. The default communication transport for local MCP servers.
- **Chain ID:** Numerical identifier for different Ethereum-compatible blockchains (e.g., 1 for Mainnet, 11155111 for Sepolia).
- **(New) LLM (Large Language Model):** A type of artificial intelligence model capable of understanding and generating human-like text (e.g., Google Gemini).
- **(New) Agentic Capability:** The server's ability to autonomously plan, execute API calls, and synthesize results based on a high-level prompt.
- **(New) Planning Step:** The phase where the LLM analyzes the prompt and determines which Etherscan API calls are needed.
- **(New) Execution Step:** The phase where the server executes the planned API calls using `EtherscanClient`.
- **(New) Synthesis Step:** The phase where the LLM combines the original prompt and execution results into a final answer.

## Section 2: System Architecture & Design

### 2.1 High-Level Overview

The server follows a standard MCP architecture using the `@mcp/server` TypeScript SDK. It listens for incoming MCP requests (primarily `tools/list` and `tools/call`) over a specified transport (defaulting to `stdio`).

**Standard Tool Flow:**
Client -> MCP Server (`tools/call:etherscan_someTool`) -> Tool Handler Logic (`index.ts`) -> `EtherscanClient` -> Etherscan API -> `EtherscanClient` -> Tool Handler Logic -> MCP Server -> Client

**(New) Agent Tool Flow:**
Client -> MCP Server (`tools/call:etherscan_runAgentTask`) -> Tool Handler Logic (`index.ts`) -> Agent Logic (`agent.ts:runAgentTask`) -> Google Gemini (Planning) -> Agent Logic (Plan Parsing) -> `EtherscanClient` (Execution Loop) -> Etherscan API -> `EtherscanClient` -> Agent Logic (Result Aggregation) -> Google Gemini (Synthesis) -> Agent Logic -> Tool Handler Logic -> MCP Server -> Client

### 2.2 Core Components

- **MCP Server Runtime (`@mcp/server` SDK):** Manages the MCP protocol handshake, message parsing/serialization, tool discovery (`listTools`), tool invocation (`callTool`), input/output validation (via Zod schemas), and transport handling (`stdio`).
- **Main Server Entry Point (`src/index.ts`):** Initializes the MCP Server instance, loads environment variables (`dotenv`), instantiates the `EtherscanClient` **and Google Generative AI Model**, registers all defined tools with the SDK, defines the `tools/call` handler logic (routing calls to `EtherscanClient` methods **or the agent function**), and starts the server run loop.
  **Etherscan API Client (`src/utils/client.ts`):** A custom `EtherscanClient` class encapsulating the logic for interacting with the Etherscan API. It holds the API key, constructs request URLs, uses `axios` to make HTTP requests, performs response validation, and throws `EtherscanError` on failures.
- **HTTP Request Library (`axios`):** Used by `EtherscanClient` to perform the actual HTTP GET/POST requests to the Etherscan API.
- **Utilities (`src/utils/*.ts`):** Includes shared TypeScript types/interfaces (`types.ts`) and the custom `EtherscanError` class (defined within `client.ts`).
- **Tool Definitions (`src/tools/*.ts`):** Individual files defining the metadata (`name`, `description`, `inputSchema` using Zod) for each MCP tool. These definitions are imported and registered in `src/index.ts`.
- **(New) Agent Logic (`src/agent/agent.ts`):** Contains the `runAgentTask` function responsible for orchestrating the planning (via LLM), execution (via `EtherscanClient`), and synthesis (via LLM) steps for the `etherscan_runAgentTask` tool.
- **(New) Google Generative AI SDK (`@google/generative-ai`):** Used to interact with the Google Gemini LLM for the planning and synthesis steps within the agent logic.
- **Type Definitions (`src/utils/types.ts`):** TypeScript interfaces defining the expected structures of Etherscan API responses.
- **Zod Schemas:** Used for defining `inputSchema` for tools, providing robust runtime validation and type safety.

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

### 3.2 Tool Handlers (`src/tools/*.ts` and logic in `src/index.ts`)

- **Responsibilities:**
  - Define the MCP tool metadata (`name`, `description`, `inputSchema`) in `src/tools/*.ts` files.
  - **(Updated)** The central `tools/call` handler in `src/index.ts` receives validated input parameters from the MCP SDK.
  - **(Updated)** The central handler logs the incoming request details.
  - **(Updated)** The central handler maps the `toolName` to the corresponding `EtherscanClient` method **or the `runAgentTask` function**.
  - **(Updated)** The central handler invokes the appropriate function with the validated arguments.
  - **(Updated)** The central handler receives the result (or error) from the `EtherscanClient` **or `runAgentTask`**.
  - **(Updated)** The central handler formats the result into the required MCP `ToolResultContent` structure (typically `{ type: 'text', text: '...' }`).
  - **(Updated)** The central handler logs the final response or error.
  - **(New)** A new tool definition file `src/tools/agent.ts` will be created for `etherscan_runAgentTask`.
- **Interfaces/APIs (Internal):** Calls methods on the shared `EtherscanClient` instance **and the `runAgentTask` function.**

### (New) 3.3 Agent Logic (`src/agent/agent.ts`)

- **Responsibilities:**
  - Implement the `runAgentTask(prompt: string, etherscanClient: EtherscanClient, geminiModel: GenerativeModel): Promise<string>` function.
  - **Planning:** Construct a detailed system prompt for the Gemini LLM, providing the user's request and a list of available `EtherscanClient` functions (potentially with descriptions/schemas). Request the LLM to generate a JSON plan outlining the sequence of Etherscan calls needed.
  - **Plan Parsing:** Parse and validate the JSON plan received from the LLM. Handle potential parsing errors or invalid plan structures.
  - **Execution:** Iterate through the validated plan. For each step, call the corresponding method on the `etherscanClient` instance with the parameters specified in the plan. Aggregate the results (successful data or error messages) from each step.
  - **Synthesis:** Construct a second prompt for the Gemini LLM, providing the original user prompt and the aggregated results (including any errors) from the execution step. Request the LLM to generate a final, user-friendly text response summarizing the findings.
  - **Return Value:** Return the synthesized text response as a string.
  - **Error Handling:** Implement robust `try...catch` blocks around LLM calls, plan parsing, and Etherscan client calls. Catch and log errors gracefully, potentially including error information in the synthesis step.
  - **Logging:** Implement comprehensive `console.error` logging for each major step (receiving prompt, planning prompt/response, parsed plan, execution calls/results, synthesis prompt/response, final output, errors).
- **Interfaces/APIs (Internal):**
  - Called by the `etherscan_runAgentTask` case within the `tools/call` handler in `src/index.ts`.
  - Calls `geminiModel.generateContent()` for planning and synthesis.
  - Calls various methods on the passed `etherscanClient` instance during execution.

## Section 4: API/Protocol Specifications

### 4.1 External Interfaces Overview

The primary external interface is the Model Context Protocol itself, exposed via the configured transport (default: `stdio`). Clients interact via standard MCP messages:

- **Initialization Handshake:** Standard MCP client/server initialization.
- **`tools/list`:** Client requests the list of available tools.
- **`tools/call`:** Client requests the execution of a specific tool with arguments.
- **`logging` Notifications:** Server sends log messages back to the client.

### 4.2 Data Formats / Models (Tool Definitions)

Each tool is defined as a plain object with metadata, and the execution logic is centralized in `src/index.ts`.

```typescript
// Example structure in src/tools/*.ts
export interface McpToolDefinition {
  name: string; // Unique tool name (e.g., "etherscan_getBalance")
  description: string; // User-friendly description
  inputSchema: z.ZodTypeAny; // Zod schema defining expected input parameters
}

export const exampleToolDef: McpToolDefinition = {
  name: "etherscan_exampleTool",
  description: "An example tool.",
  inputSchema: z.object({
    /* ... Zod schema ... */
  }),
};
```

The `inputSchema` (Zod) is converted to JSON Schema by the server when responding to `tools/list`. Common input parameters like `chainId: number` are included in the `inputSchema` for relevant tools.

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
- **(New) LLM SDK:** `@google/generative-ai` (latest)
- **Package Manager:** `npm` or `yarn`

### 6.2 Code Structure / Project Layout

`````
etherscan-mcp/
├── node_modules/
├── src/
│   ├── index.ts       # Main entry point, server setup, tool registration
│   ├── agent/
│   │   └── agent.ts   # (New) Core logic for the agentic capability
│   ├── tools/
│   │   ├── account.ts   # Tool definitions for 'account' module
│   │   ├── contract.ts  # Tool definitions for 'contract' module
│   │   ├── agent.ts     # (New) Tool definition for agent task
│   │   └── ...        # Other tool definition files
│   └── utils/
│       ├── client.ts    # Etherscan API client class
│       ├── types.ts     # TypeScript types for API responses
│       └── errors.ts    # Custom error classes (optional)
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
- `EtherscanClient` validates responses and throws specific (`EtherscanError`) or standard `Error` errors on API issues (bad status, error messages in response).
- The central `tools/call` handler catches errors from `EtherscanClient` **or `runAgentTask`** and wraps them in `McpError` using appropriate `ErrorCode` values (`InvalidParams`, `InternalError`, etc.) before returning to the client.
- **(New)** The `runAgentTask` function includes specific error handling for:
    - LLM API calls (network errors, authentication, rate limits, invalid responses) via the Google AI SDK.
    - Parsing the LLM's generated plan (invalid JSON, incorrect structure).
    - Errors during the execution phase originating from `EtherscanClient`.
    - Errors during the synthesis LLM call.
    - These internal agent errors should be logged comprehensively and potentially wrapped before being thrown up to the main handler.

### 6.5 Logging Strategy

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
      - **(New) Agent Step Logging (within `runAgentTask`):**
      - Received user prompt.
      - Constructed planning prompt sent to LLM.
      - Raw plan received from LLM.
      - Parsed/validated plan.
      - Each execution step: function called, parameters, success/failure, result/error message.
      - Aggregated execution results.
      - Constructed synthesis prompt sent to LLM.
      - Final synthesized text response from LLM.
      - Any errors encountered during planning, parsing, execution, or synthesis.

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

- The primary credentials are the `ETHERSCAN_API_KEY` **and (New) `GOOGLE_API_KEY`**.
- Store securely using environment variables (loaded via `.env` file locally or configured in the deployment/host environment).
- Ensure `.env` file is in `.gitignore`.

### (Optional) 7.5 Threat Model

- **API Key Leakage:** Mitigation: Use environment variables, `.gitignore`, secure host configuration.
- **Denial of Service (DoS) via Tool Calls:** Mitigation: User approval required by host, potential Etherscan rate limiting.
- **Malformed Input:** Mitigation: Zod schema validation by SDK.
- **Etherscan API Issues:** Mitigation: Error handling, logging.
- **(New) LLM Prompt Injection:** Mitigation: Careful system prompt design, potentially sanitizing user input within the agent, avoid including sensitive data in LLM prompts.
- **(New) LLM Data Privacy:** Mitigation: Be aware prompts/results are sent to Google; refer to their policies.
- **(New) LLM Hallucination/Incorrect Actions:** Mitigation: Validate planned calls, use clear prompts, treat agent results as potentially requiring verification.
- **(New) Agent DoS (via LLM Costs/Time):** Mitigation: Monitor LLM usage, consider input limits.

### (New) 7.6 LLM Interaction Security

- **Prompt Injection:** Maliciously crafted user prompts sent to `etherscan_runAgentTask` could attempt to manipulate the LLM's planning or synthesis steps, potentially causing unexpected behavior, revealing internal details (like function names if included in prompts), or generating harmful content. Mitigation involves designing robust system prompts for the LLM that clearly define its task and boundaries, avoiding the inclusion of sensitive internal details in prompts sent to the LLM, and potentially implementing input filtering on the user prompt within the agent.
- **Data Privacy:** The user prompt and the aggregated results from Etherscan API calls are sent to the external Google Gemini API during the planning and synthesis steps. Users should be aware of this data flow and consult Google's data usage and privacy policies.
- **Denial of Service / Cost Overruns:** Complex or malicious prompts could lead to numerous or computationally expensive LLM interactions, incurring unexpected costs or delaying responses. Mitigation includes monitoring LLM API usage and costs, potentially setting usage quotas or budgets via the cloud provider, and possibly implementing basic checks on prompt length or complexity within the agent tool handler.
- **Incorrect Actions / Hallucination:** The LLM might generate an incorrect plan (calling the wrong Etherscan functions or with wrong parameters) or synthesize an inaccurate final response based on the execution results. Mitigation involves validating the structure and function names within the generated plan before execution, designing clear and unambiguous prompts, and potentially adding a disclaimer to the user that the agent's output is generated by an LLM and may require verification.

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
- **End-to-End Testing (Primary):** A dedicated script (`test/e2e.ts`) uses the `@mcp/client` SDK to connect to the running server via stdio and execute a predefined suite of `tools/call` requests covering various tools, parameters, and chains. Results are logged to the console. This was the main method used for Phase 8 validation.
- **Manual Testing (During Development):** Using `mcp run tool` or the MCP Inspector during feature implementation.
- **Unit Testing (Not Implemented):** No unit tests were created for this project, relying instead on E2E testing.

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
- **Registration:** The server needs to be registered manually with the MCP host environment by editing the host's configuration file (`settings.json` for VS Code, `claude_desktop_config.json` for Desktop App) as detailed in `README.md`. This allows setting the required `ETHERSCAN_API_KEY` environment variable.
- **CI/CD:** Not implemented.

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

These snippets illustrate the core implementation patterns used in this Etherscan MCP Server.

### C.1 Basic Server Initialization (`src/index.ts` Snippet)

```typescript
import dotenv from "dotenv";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { EtherscanClient, EtherscanError } from "./utils/client.js";
import { zodToJsonSchema } from "zod-to-json-schema";
// Import combined tool definitions array (assuming it's defined elsewhere)
import { allToolDefinitions, McpToolDefinition } from "./tools/index.js"; // Example import

// Load environment variables
dotenv.config();
const apiKey = process.env.ETHERSCAN_API_KEY;
if (!apiKey) {
  console.error("FATAL: ETHERSCAN_API_KEY environment variable not set.");
  process.exit(1);
}

// Initialize Client
let etherscanClient: EtherscanClient;
try {
  etherscanClient = new EtherscanClient(apiKey);
} catch (error: any) {
  console.error("[Setup] Failed to initialize EtherscanClient:", error.message);
  process.exit(1);
}

// Initialize MCP Server
const server = new Server(
  { name: "etherscan-mcp", version: "0.1.0" }, // Server Info
  { capabilities: { tools: {} } } // Server Options (declaring tools capability)
);

// Handler for listing tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const toolsWithJsonSchema = allToolDefinitions.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.inputSchema, { $refStrategy: "none" }),
  }));
  return { tools: toolsWithJsonSchema };
});

// Central handler for calling tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const tool = allToolDefinitions.find((t) => t.name === toolName);

  if (!tool) {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
  }

  // Validate input
  const validationResult = tool.inputSchema.safeParse(request.params.arguments);
  if (!validationResult.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid input for tool ${toolName}: ${JSON.stringify(
        validationResult.error.format()
      )}`
    );
  }
  const validatedArgs = validationResult.data as any;

  try {
    let resultText: string;
    // --- Central Switch Statement for Tool Logic ---
    switch (toolName) {
      case "etherscan_getBalance":
        const balanceResponse = await etherscanClient.getBalance(validatedArgs);
        resultText = `Balance: ${balanceResponse.result} wei`;
        break;
      // ... other cases calling etherscanClient methods ...
      default:
        throw new Error(`Tool ${toolName} handler not implemented.`);
    }

    return { content: [{ type: "text", text: resultText }] };
  } catch (error: any) {
    console.error(`[Server:callTool] Error executing ${toolName}:`, error);
    if (error instanceof McpError) throw error;
    if (error instanceof EtherscanError) {
      throw new McpError(
        ErrorCode.InternalError,
        `Etherscan Client Error: ${error.message}`
      );
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Unexpected error: ${error.message || "Unknown"}`
    );
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[Setup] Server connected via stdio.");
}

main().catch((error) => {
  console.error("[Setup] Server encountered fatal error:", error);
  process.exit(1);
});
```

### C.2 Example Tool Definition (`src/tools/account.ts` Snippet)

```typescript
import { z } from "zod";

// Define the structure for tool definitions (used across tool files)
export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
}

// --- Schemas ---
const EthereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format");
const ChainIdSchema = z
  .number()
  .int()
  .positive("Chain ID must be a positive integer");

const GetBalanceInputSchema = z.object({
  address: EthereumAddressSchema,
  chainId: ChainIdSchema,
});

// --- Tool Definition Object ---
/**
 * MCP Tool Definition: Get Ether Balance for a single address.
 */
export const etherscan_getBalance_Def: McpToolDefinition = {
  name: "etherscan_getBalance",
  description:
    "Get the Ether balance for a single address on a specific chain.",
  inputSchema: GetBalanceInputSchema,
};

// --- Export Array ---
// Array containing all tool definitions for this module
export const accountToolDefinitions: McpToolDefinition[] = [
  etherscan_getBalance_Def,
  // ... other account tool definitions
];
```

### C.3 EtherscanClient Snippet (`src/utils/client.ts` Snippet)

```typescript
{{ ... }}
}
```

### (New) C.4 Agent Logic Snippet (`src/agent/agent.ts` Snippet)

````typescript
import { EtherscanClient, EtherscanError } from "../utils/client";
import { GenerativeModel } from "@google/generative-ai";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/server/index.js"; // For throwing MCP-specific errors

// Define interfaces for the expected Plan structure from the LLM
interface PlanStep {
  toolName: string; // Should map to an EtherscanClient method name
  // Parameters should align with the EtherscanClient method's arguments
  parameters: Record<string, any>;
}

interface AgentPlan {
  reasoning?: string; // Optional explanation from LLM
  steps: PlanStep[];
}

/**
 * Orchestrates planning, execution, and synthesis for a user prompt.
 *
 * @param prompt The natural language query from the user.
 * @param etherscanClient An initialized EtherscanClient instance.
 * @param geminiModel An initialized Google Generative AI Model instance.
 * @returns A promise resolving to the synthesized string answer.
 * @throws {McpError} If a non-recoverable error occurs (e.g., LLM auth, fatal planning error).
 */
export async function runAgentTask(
  prompt: string,
  etherscanClient: EtherscanClient,
  geminiModel: GenerativeModel
): Promise<string> {
  console.error(`[Agent] Received prompt: "${prompt}"`);

  let plan: AgentPlan | null = null;
  const executionResults: { step: number; result?: any; error?: string }[] = [];

  try {
    // --- 1. Planning Step ---
    console.error("[Agent] Starting Planning Step...");
    const planningPrompt = buildPlanningPrompt(prompt, etherscanClient); // Helper to construct the prompt
    console.error("[Agent] Planning prompt constructed. Calling Gemini...");

    const planningResult = await geminiModel.generateContent(planningPrompt);
    const planningResponseText = planningResult.response.text();
    console.error(
      "[Agent] Received planning response text (raw):",
      planningResponseText
    );

    plan = parseAndValidatePlan(planningResponseText); // Helper to parse JSON and validate structure
    console.error(
      "[Agent] Plan parsed successfully:",
      JSON.stringify(plan, null, 2)
    );

    // --- 2. Execution Step ---
    console.error("[Agent] Starting Execution Step...");
    if (!plan || plan.steps.length === 0) {
      console.error("[Agent] No valid execution steps in the plan.");
      executionResults.push({
        step: 0,
        error: "Agent could not determine actions needed.",
      });
    } else {
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        console.error(
          `[Agent] Executing Step ${i + 1}: ${step.toolName} with params:`,
          step.parameters
        );

        // IMPORTANT: Map step.toolName to actual EtherscanClient methods securely
        // Avoid using eval(). Use a switch statement or a map.
        let stepResult: any = null;
        let stepError: string | null = null;

        try {
          // Example using a switch (add all planned EtherscanClient methods)
          switch (step.toolName) {
            case "getBalance":
              // Ensure parameters match EtherscanClient.getBalance input
              stepResult = await etherscanClient.getBalance(
                step.parameters as any
              );
              break;
            case "getNormalTransactions":
              stepResult = await etherscanClient.getNormalTransactions(
                step.parameters as any
              );
              break;
            // ... add cases for ALL other EtherscanClient methods the LLM might plan ...
            default:
              throw new Error(`Unsupported tool planned: ${step.toolName}`);
          }
          console.error(
            `[Agent] Step ${i + 1} (${step.toolName}) executed successfully.`
          );
          executionResults.push({ step: i + 1, result: stepResult });
        } catch (error: any) {
          console.error(
            `[Agent] Error executing Step ${i + 1} (${step.toolName}):`,
            error
          );
          stepError =
            error instanceof Error ? error.message : "Unknown execution error";
          executionResults.push({ step: i + 1, error: stepError });
          // Decide if agent should stop on first error, or continue?
          // For now, let's continue and let synthesis handle errors.
        }
      }
    }
    console.error("[Agent] Execution finished. Results:", executionResults);

    // --- 3. Synthesis Step ---
    console.error("[Agent] Starting Synthesis Step...");
    const synthesisPrompt = buildSynthesisPrompt(prompt, executionResults); // Helper to format results for LLM
    console.error("[Agent] Synthesis prompt constructed. Calling Gemini...");

    const synthesisResult = await geminiModel.generateContent(synthesisPrompt);
    const finalAnswer = synthesisResult.response.text();
    console.error("[Agent] Received final synthesized answer:", finalAnswer);

    return finalAnswer;
  } catch (error: any) {
    console.error("[Agent] Unrecoverable error during agent task:", error);
    // Throw an MCPError that the main handler can catch and return to the client
    throw new McpError(
      ErrorCode.InternalError, // Or a more specific code if applicable
      `Agent failed: ${error.message || "Unknown agent error"}`
    );
  }
}

// --- Helper Functions (Implement these) ---

function buildPlanningPrompt(
  userPrompt: string,
  client: EtherscanClient
): string {
  // TODO: Construct a detailed prompt including:
  // - Role definition (You are an expert Ethereum assistant...)
  // - User's query
  // - List of available tools (EtherscanClient methods) with descriptions/schemas
  // - Instructions to output a JSON plan in the defined AgentPlan format
  console.error("[Agent:Helper] Building planning prompt..."); // Placeholder log
  // Example structure (needs refinement):
  const availableTools = [
    {
      name: "getBalance",
      description: "Get ETH balance for an address",
      params: "{ address: string, chainId: number }",
    },
    {
      name: "getNormalTransactions",
      description: "Get normal txs for an address",
      params: "{ address: string, chainId: number, startblock?: number, ... }",
    },
    // ... List ALL relevant EtherscanClient methods ...
  ];
  return `User Query: "${userPrompt}"\n\nAvailable Tools:\n${JSON.stringify(
    availableTools,
    null,
    2
  )}\n\nGenerate a JSON plan containing a 'steps' array. Each step must use one of the available tools with correct parameters based ONLY on the user query. Output ONLY the JSON plan.
Plan Format: ${JSON.stringify({
    reasoning: "(optional brief plan)",
    steps: [
      {
        toolName: "example_tool",
        parameters: {
          /* params */
        },
      },
    ],
  })}
`;
}

function parseAndValidatePlan(responseText: string): AgentPlan {
  // TODO: Implement robust JSON parsing and validation
  // - Use try...catch for JSON.parse
  // - Validate the structure against AgentPlan interface (check for 'steps' array, etc.)
  // - Potentially clean the responseText (remove ```json ... ``` markers if LLM adds them)
  console.error("[Agent:Helper] Parsing and validating plan..."); // Placeholder log
  try {
    // Basic parsing - needs more robust validation
    const potentialPlan = JSON.parse(
      responseText.trim().replace(/```json|```/g, "")
    );
    if (!potentialPlan || !Array.isArray(potentialPlan.steps)) {
      throw new Error(
        "Invalid plan structure: 'steps' array missing or invalid."
      );
    }
    // Add more checks: step objects have toolName, parameters, etc.
    return potentialPlan as AgentPlan;
  } catch (e: any) {
    console.error("[Agent:Helper] Failed to parse or validate plan:", e);
    throw new Error(`LLM generated invalid plan: ${e.message}`);
  }
}

function buildSynthesisPrompt(
  originalPrompt: string,
  results: Array<{ step: number; result?: any; error?: string }>
): string {
  // TODO: Construct prompt for final answer generation including:
  // - Role definition
  // - Original user query
  // - Formatted results from execution steps (both successes and errors)
  // - Instruction to provide a concise, helpful answer to the original query.
  console.error("[Agent:Helper] Building synthesis prompt..."); // Placeholder log
  return `Original Query: "${originalPrompt}"\n\nExecution Results:\n${JSON.stringify(
    results,
    null,
    2
  )}\n\nBased on the original query and the execution results, provide a comprehensive and user-friendly answer. If errors occurred, mention them briefly. Answer the query directly.`;
}
`````

```

```
