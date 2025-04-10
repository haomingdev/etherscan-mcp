#!/usr/bin/env node

import dotenv from "dotenv";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { EtherscanClient } from "./utils/client.js";
import { accountToolDefinitions, McpToolDefinition } from "./tools/account.js"; // Import definitions and type
import {
  EtherscanBalanceResponse,
  EtherscanTxListResponse,
} from "./utils/types.js"; // Import response types for handling
import { zodToJsonSchema } from "zod-to-json-schema"; // Import the conversion function

// Load environment variables from .env file
dotenv.config();

// --- Configuration ---
const apiKey = process.env.ETHERSCAN_API_KEY;
if (!apiKey) {
  console.error("FATAL: ETHERSCAN_API_KEY environment variable not set.");
  process.exit(1);
}

// --- Initialize Etherscan Client ---
let etherscanClient: EtherscanClient;
try {
  etherscanClient = new EtherscanClient(apiKey);
  console.error("[Setup] EtherscanClient initialized successfully."); // Log to stderr
} catch (error: any) {
  console.error("[Setup] Failed to initialize EtherscanClient:", error.message); // Log to stderr
  process.exit(1);
}

// --- Initialize MCP Server ---
console.error("[Setup] Starting Etherscan MCP Server..."); // Log to stderr
const server = new Server(
  {
    // Consider reading name/version from package.json
    name: "etherscan-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      // Only enabling tools capability as per the plan
      tools: {},
      // resources: {}, // Removed
      // prompts: {}, // Removed
    },
  }
);

console.error("[Setup] Server initialized. Setting up request handlers..."); // Log to stderr

// --- Tool Handlers ---

/**
 * Handler that lists available tools.
 * Serves the tool definitions imported from tool files.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error(
    "[Server:listTools] Received request. Serving defined account tools."
  ); // Changed to stderr for now

  // Convert Zod schemas to JSON Schemas before returning
  const toolsWithJsonSchema = accountToolDefinitions.map(
    (tool: McpToolDefinition) => {
      try {
        // Pass options to inline definitions instead of using $ref
        const jsonSchema = zodToJsonSchema(tool.inputSchema, { $refStrategy: 'none' });

        console.error(`[Server:listTools] Successfully converted schema for ${tool.name}`); // Log success

        return {
          name: tool.name,
          description: tool.description,
          inputSchema: jsonSchema, // Send the converted JSON Schema
        };
      } catch (error: any) {
        // Log any error during conversion
        console.error(`[Server:listTools] Error converting schema for ${tool.name}:`, error.message);
        console.error("[Server:listTools] Zod Schema:", JSON.stringify(tool.inputSchema.shape, null, 2)); // Log the input schema shape
        // Return a placeholder or rethrow, depending on desired behavior.
        // For now, let's return a minimal structure to potentially avoid crashing the map.
        return {
          name: tool.name,
          description: tool.description,
          inputSchema: { type: "object", properties: {}, error: `Conversion failed: ${error.message}` }, // Placeholder schema
        };
      }
    }
  );

  // Log the final array before returning (even if some conversions failed)
  console.error("[Server:listTools] Final tools structure:", JSON.stringify(toolsWithJsonSchema, null, 2));

  return {
    tools: toolsWithJsonSchema,
  };
});

/**
 * Handler for executing tools.
 * This will route requests to specific tool implementation functions.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  console.error(`[Server:callTool] Received request for tool: ${toolName}`); // Changed to stderr for now

  // 1. Find the tool definition
  const tool: McpToolDefinition | undefined = accountToolDefinitions.find(
    (t: McpToolDefinition) => t.name === toolName
  );
  if (!tool) {
    console.error(`[Server:callTool] Unknown tool requested: ${toolName}`);
    throw new Error(`Unknown tool: ${toolName}`);
  }

  // 2. Validate input arguments against the tool's Zod schema
  console.error(`[Server:callTool] Validating input for ${toolName}...`); // Changed to stderr for now
  const validationResult = tool.inputSchema.safeParse(request.params.arguments);
  if (!validationResult.success) {
    const errorDetail = validationResult.error.format();
    console.error(
      `[Server:callTool] Invalid input for ${toolName}:`,
      errorDetail
    );
    // Provide a more specific error message based on Zod's errors
    throw new Error(
      `Invalid input for tool ${toolName}: ${JSON.stringify(errorDetail)}`
    );
  }
  const validatedArgs = validationResult.data as any; // Cast to any for easier use in switch, validation already done
  console.error(
    `[Server:callTool] Input validated successfully for ${toolName}.`
  ); // Changed to stderr for now

  // 3. Execute the corresponding EtherscanClient method
  try {
    console.error(
      `[Server:callTool] Executing EtherscanClient method for ${toolName}...`
    );
    let responseData: EtherscanBalanceResponse | EtherscanTxListResponse;
    let resultText: string;

    switch (toolName) {
      case "etherscan_getBalance":
        responseData = await etherscanClient.getBalance(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API Status: ${responseData.status}, Message: ${responseData.message}`
        ); // Changed to stderr for now
        if (responseData.status === "1") {
          resultText = `Balance for ${validatedArgs.address} (Chain ${validatedArgs.chainId}): ${responseData.result} wei`;
        } else {
          // Etherscan API returned an error status
          resultText = `Etherscan API Error (${toolName}): ${
            responseData.message || "Unknown API error"
          } (Result: ${responseData.result})`;
          console.error(
            `[Server:callTool][${toolName}] API Error Response:`,
            responseData
          );
        }
        break;

      case "etherscan_getNormalTransactions":
        responseData = await etherscanClient.getNormalTransactions(
          validatedArgs
        );
        console.error(
          `[Server:callTool][${toolName}] Etherscan API Status: ${responseData.status}, Message: ${responseData.message}`
        ); // Changed to stderr for now
        if (responseData.status === "1") {
          const txs = responseData.result as EtherscanTxListResponse["result"];
          if (txs.length === 0) {
            resultText = `No normal transactions found for ${validatedArgs.address} within the specified parameters.`;
          } else {
            // Format transaction list concisely
            resultText =
              `Found ${txs.length} normal transactions for ${
                validatedArgs.address
              } (latest ${txs.length < 5 ? txs.length : 5}):\n` +
              txs
                .slice(0, 5)
                .map(
                  (tx) =>
                    `- Hash: ${tx.hash.substring(0, 10)}... Value: ${
                      tx.value
                    } wei @ ${new Date(
                      parseInt(tx.timeStamp) * 1000
                    ).toLocaleDateString()}`
                )
                .join("\n");
            if (txs.length > 5)
              resultText += "\n... (more transactions available)";
          }
        } else {
          // Etherscan API returned an error status
          resultText = `Etherscan API Error (${toolName}): ${
            responseData.message || "Unknown API error"
          } (Result: ${responseData.result})`;
          console.error(
            `[Server:callTool][${toolName}] API Error Response:`,
            responseData
          );
        }
        break;

      default:
        // Log error to stderr
        console.error(
          `[Server:callTool] Logic error: Tool ${toolName} found but not handled in switch.`
        );
        throw new Error(
          `Internal Server Error: Tool ${toolName} handler not implemented.`
        );
    }

    // 4. Format and return success response (even if Etherscan API had an error status)
    console.error(
      `[Server:callTool] Successfully processed ${toolName}. Etherscan API Status: ${responseData.status}`
    ); // Changed to stderr for now
    return {
      content: [
        {
          type: "text",
          text: resultText,
        },
      ],
    };
  } catch (error: any) {
    console.error(
      `[Server:callTool] Error during execution of tool ${toolName}:`,
      error
    );
    // Catch errors from EtherscanClient (e.g., network errors) or unexpected issues in this handler
    throw new Error(
      `Error executing tool ${toolName}: ${
        error.message || "An unexpected error occurred"
      }`
    );
  }
});

// --- Server Start ---

/**
 * Main function to start the server using stdio transport.
 */
async function main() {
  console.error("[Setup] Starting Etherscan MCP Server..."); // Log to stderr
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[Setup] Server connected via stdio. Waiting for requests..."); // Log to stderr
}

main().catch((error) => {
  console.error("[Setup] Server encountered fatal error:", error);
  process.exit(1);
});
