#!/usr/bin/env node

import dotenv from "dotenv";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  EtherscanClient,
  MultiBalanceApiResponse,
  MultiBalanceResponseItem,
} from "./utils/client.js";
import {
  EtherscanTxListResponse,
  EtherscanNormalTransaction,
  EtherscanInternalTxListResponse, // Added
  EtherscanInternalTransaction, // Added
  EtherscanTokenTxResponse, // Added
  EtherscanTokenTransfer, // Added
  EtherscanMinedBlocksResponse,
  EtherscanMinedBlock,
  EtherscanGetSourceCodeResponse,
  EtherscanGetAbiResponse,
  EtherscanTokenSupplyResponse,
  EtherscanTokenInfoResponse,
  EtherscanTokenInfo,
  TxReceiptStatusResponse, // Added for Transaction module
  TxExecutionStatusResponse, // Added for Transaction module
} from "./utils/types.js";
import { accountToolDefinitions, McpToolDefinition } from "./tools/account.js";
import { contractToolDefinitions } from "./tools/contract.js";
import { tokenToolDefinitions } from "./tools/token.js";
import { transactionToolDefinitions } from "./tools/transaction.js"; // Added import for transaction tools
import {
  EtherscanBalanceResponse,
  EtherscanGetLogsResponse,
} from "./utils/types.js"; // Import response types for handling
import { zodToJsonSchema } from "zod-to-json-schema"; // Import the conversion function
import { logTools } from "./tools/log.js"; // Added import for log tools

// Combine all tool definitions
const allToolDefinitions = [
  ...accountToolDefinitions,
  ...contractToolDefinitions,
  ...tokenToolDefinitions,
  ...transactionToolDefinitions, // Added transaction tools
  ...logTools, // Added log tools
];

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
    "[Server:listTools] Received request. Serving all defined tools." // Updated log message
  );

  // Convert Zod schemas to JSON Schemas before returning
  const toolsWithJsonSchema = allToolDefinitions.map(
    (tool: McpToolDefinition) => {
      // Use combined array
      try {
        // Pass options to inline definitions instead of using $ref
        const jsonSchema = zodToJsonSchema(tool.inputSchema, {
          $refStrategy: "none",
        });

        console.error(
          `[Server:listTools] Successfully converted schema for ${tool.name}`
        ); // Log success

        return {
          name: tool.name,
          description: tool.description,
          inputSchema: jsonSchema, // Send the converted JSON Schema
        };
      } catch (error: any) {
        // Log any error during conversion
        console.error(
          `[Server:listTools] Error converting schema for ${tool.name}:`,
          error.message
        );
        // Removed the line causing the error: console.error("[Server:listTools] Zod Schema:", JSON.stringify(tool.inputSchema.shape, null, 2));
        // Return a placeholder or rethrow, depending on desired behavior.
        // For now, let's return a minimal structure to potentially avoid crashing the map.
        return {
          name: tool.name,
          description: tool.description,
          inputSchema: {
            type: "object",
            properties: {},
            error: `Conversion failed: ${error.message}`,
          }, // Placeholder schema
        };
      }
    }
  );

  // Log the final array before returning (even if some conversions failed)
  console.error(
    "[Server:listTools] Final tools structure:",
    JSON.stringify(toolsWithJsonSchema, null, 2)
  );

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
  console.error(`[Server:callTool] Received request for tool: ${toolName}`);

  // 1. Find the tool definition from the combined list
  const tool: McpToolDefinition | undefined = allToolDefinitions.find(
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
    let responseData:
      | EtherscanBalanceResponse
      | EtherscanTxListResponse
      | MultiBalanceApiResponse
      | EtherscanInternalTxListResponse
      | EtherscanTokenTxResponse
      | EtherscanMinedBlocksResponse
      | EtherscanGetSourceCodeResponse
      | EtherscanGetAbiResponse
      | EtherscanTokenSupplyResponse
      | EtherscanTokenInfoResponse
      | TxReceiptStatusResponse // Added
      | TxExecutionStatusResponse // Added
      | EtherscanGetLogsResponse; // Added for logs
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
        const response: EtherscanTxListResponse =
          await etherscanClient.getNormalTransactions(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API Status: ${response.status}, Message: ${response.message}`
        ); // Changed to stderr for now
        if (response.status === "1") {
          const txs = response.result as EtherscanTxListResponse["result"];
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
                  (tx: EtherscanNormalTransaction) =>
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
            response.message || "Unknown API error"
          } (Result: ${response.result})`;
          console.error(
            `[Server:callTool][${toolName}] API Error Response:`,
            response
          );
        }
        break;

      case "etherscan_getMultiBalance":
        const multiBalanceResponse: MultiBalanceApiResponse =
          await etherscanClient.getMultiBalance(
            validatedArgs.addresses,
            validatedArgs.chainId
          );
        console.error(
          `[Server:callTool][${toolName}] Etherscan API Status: ${multiBalanceResponse.status}, Message: ${multiBalanceResponse.message}`
        ); // Changed to stderr for now
        if (multiBalanceResponse.status === "1") {
          const balances = multiBalanceResponse.result;
          const output = balances.map((balance: MultiBalanceResponseItem) => ({
            // Add type for 'balance'
            account: balance.account,
            balance: balance.balance,
          }));
          resultText = JSON.stringify(output, null, 2);
        } else {
          // Etherscan API returned an error status
          resultText = `Etherscan API Error (${toolName}): ${
            multiBalanceResponse.message || "Unknown API error"
          } (Result: ${multiBalanceResponse.result})`;
          console.error(
            `[Server:callTool][${toolName}] API Error Response:`,
            multiBalanceResponse
          );
        }
        break;

      // --- Added Cases for Phase 2B ---
      case "etherscan_getInternalTransactions":
        const internalTxResponse: EtherscanInternalTxListResponse =
          await etherscanClient.getInternalTransactions(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API Status: ${internalTxResponse.status}, Message: ${internalTxResponse.message}`
        );
        if (internalTxResponse.status === "1") {
          const txs = internalTxResponse.result;
          if (txs.length === 0) {
            resultText = `No internal transactions found for the specified parameters.`;
          } else {
            resultText =
              `Found ${txs.length} internal transactions (latest ${
                txs.length < 5 ? txs.length : 5
              }):\n` +
              txs
                .slice(0, 5)
                .map(
                  (tx: EtherscanInternalTransaction) =>
                    `- From: ${tx.from.substring(
                      0,
                      10
                    )}... To: ${tx.to.substring(0, 10)}... Value: ${
                      tx.value
                    } wei (Parent Hash: ${tx.hash.substring(0, 10)}...)`
                )
                .join("\n");
            if (txs.length > 5)
              resultText += "\n... (more transactions available)";
          }
        } else {
          resultText = `Etherscan API Error (${toolName}): ${
            internalTxResponse.message || "Unknown API error"
          } (Result: ${internalTxResponse.result})`;
          console.error(
            `[Server:callTool][${toolName}] API Error Response:`,
            internalTxResponse
          );
        }
        break;

      case "etherscan_getTokenTransfers":
        const tokenTxResponse: EtherscanTokenTxResponse =
          await etherscanClient.getTokenTransfers(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API Status: ${tokenTxResponse.status}, Message: ${tokenTxResponse.message}`
        );
        if (tokenTxResponse.status === "1") {
          const txs = tokenTxResponse.result;
          if (txs.length === 0) {
            resultText = `No token transfers found for the specified parameters.`;
          } else {
            resultText =
              `Found ${txs.length} token transfers (latest ${
                txs.length < 5 ? txs.length : 5
              }):\n` +
              txs
                .slice(0, 5)
                .map(
                  (tx: EtherscanTokenTransfer) =>
                    `- Token: ${tx.tokenSymbol} (${
                      tx.tokenName
                    }) From: ${tx.from.substring(
                      0,
                      10
                    )}... To: ${tx.to.substring(0, 10)}... Value/ID: ${
                      tx.value
                    } (Hash: ${tx.hash.substring(0, 10)}...)`
                )
                .join("\n");
            if (txs.length > 5)
              resultText += "\n... (more transfers available)";
          }
        } else {
          resultText = `Etherscan API Error (${toolName}): ${
            tokenTxResponse.message || "Unknown API error"
          } (Result: ${tokenTxResponse.result})`;
          console.error(
            `[Server:callTool][${toolName}] API Error Response:`,
            tokenTxResponse
          );
        }
        break;

      case "etherscan_getMinedBlocks":
        const minedBlocksResponse: EtherscanMinedBlocksResponse =
          await etherscanClient.getMinedBlocks(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API Status: ${minedBlocksResponse.status}, Message: ${minedBlocksResponse.message}`
        );
        if (minedBlocksResponse.status === "1") {
          const blocks = minedBlocksResponse.result;
          if (blocks.length === 0) {
            resultText = `No blocks found validated by ${validatedArgs.address}.`;
          } else {
            resultText =
              `Found ${blocks.length} blocks validated by ${
                validatedArgs.address
              } (latest ${blocks.length < 5 ? blocks.length : 5}):\n` +
              blocks
                .slice(0, 5)
                .map(
                  (block: EtherscanMinedBlock) =>
                    `- Block: ${block.blockNumber} Reward: ${
                      block.blockReward
                    } wei @ ${new Date(
                      parseInt(block.timeStamp) * 1000
                    ).toLocaleString()}`
                )
                .join("\n");
            if (blocks.length > 5)
              resultText += "\n... (more blocks available)";
          }
        } else {
          resultText = `Etherscan API Error (${toolName}): ${
            minedBlocksResponse.message || "Unknown API error"
          } (Result: ${minedBlocksResponse.result})`;
          console.error(
            `[Server:callTool][${toolName}] API Error Response:`,
            minedBlocksResponse
          );
        }
        break;
      // --- End Added Cases ---

      // --- Added Cases for Phase 3 ---
      case "etherscan_getSourceCode":
        const sourceCodeResponse: EtherscanGetSourceCodeResponse =
          await etherscanClient.getSourceCode(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API Status: ${sourceCodeResponse.status}, Message: ${sourceCodeResponse.message}`
        );
        if (
          sourceCodeResponse.status === "1" &&
          sourceCodeResponse.result.length > 0
        ) {
          // Assuming result is always an array with one item for source code
          const sourceInfo = sourceCodeResponse.result[0];
          // Format the output - potentially large, so maybe summarize
          resultText =
            `Source Code Info for ${validatedArgs.address}:\n` +
            `Contract Name: ${sourceInfo.ContractName}\n` +
            `Compiler Version: ${sourceInfo.CompilerVersion}\n` +
            `Optimization Used: ${
              sourceInfo.OptimizationUsed === "1" ? "Yes" : "No"
            }\n` +
            `ABI: ${
              sourceInfo.ABI.length > 100
                ? sourceInfo.ABI.substring(0, 100) + "..."
                : sourceInfo.ABI
            }\n` + // Truncate ABI
            `Source Code: ${
              sourceInfo.SourceCode.length > 200
                ? sourceInfo.SourceCode.substring(0, 200) + "..."
                : sourceInfo.SourceCode
            }`; // Truncate Source
        } else {
          resultText = `Etherscan API Error or No Source Code Found (${toolName}): ${
            sourceCodeResponse.message ||
            "Contract source code not verified or API error"
          } (Result: ${JSON.stringify(sourceCodeResponse.result)})`;
          console.error(
            `[Server:callTool][${toolName}] API Error/No Data Response:`,
            sourceCodeResponse
          );
        }
        break;

      case "etherscan_getAbi":
        const abiResponse: EtherscanGetAbiResponse =
          await etherscanClient.getAbi(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API Status: ${abiResponse.status}, Message: ${abiResponse.message}`
        );
        if (
          abiResponse.status === "1" &&
          abiResponse.result !== "Contract source code not verified"
        ) {
          // Try to parse ABI for basic validation/formatting
          try {
            const abiJson = JSON.parse(abiResponse.result);
            resultText = `ABI for ${validatedArgs.address}:\n${JSON.stringify(
              abiJson,
              null,
              2
            )}`;
          } catch (parseError) {
            console.error(
              `[Server:callTool][${toolName}] Failed to parse ABI JSON:`,
              parseError
            );
            resultText = `Received ABI for ${validatedArgs.address}, but failed to parse as JSON. Raw ABI:\n${abiResponse.result}`;
          }
        } else {
          resultText = `Etherscan API Error or ABI Not Found (${toolName}): ${
            abiResponse.message ||
            "Contract source code not verified or API error"
          } (Result: ${abiResponse.result})`;
          console.error(
            `[Server:callTool][${toolName}] API Error/No Data Response:`,
            abiResponse
          );
        }
        break;
      // --- End Added Cases ---

      // --- Added Cases for Phase 4 ---
      case "etherscan_getTokenSupply":
        const tokenSupplyResponse: EtherscanTokenSupplyResponse =
          await etherscanClient.getTokenSupply(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API Status: ${tokenSupplyResponse.status}, Message: ${tokenSupplyResponse.message}`
        );
        if (tokenSupplyResponse.status === "1") {
          resultText = `Total supply for ${validatedArgs.contractaddress}: ${tokenSupplyResponse.result}`;
          // Note: Handler doesn't know decimals here, returning raw supply string. Client might need to fetch decimals separately.
        } else {
          resultText = `Etherscan API Error (${toolName}): ${
            tokenSupplyResponse.message || "Unknown API error"
          } (Result: ${tokenSupplyResponse.result})`;
          console.error(
            `[Server:callTool][${toolName}] API Error Response:`,
            tokenSupplyResponse
          );
        }
        break;

      case "etherscan_getTokenInfo":
        const tokenInfoResponse: EtherscanTokenInfoResponse =
          await etherscanClient.getTokenInfo(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API Status: ${tokenInfoResponse.status}, Message: ${tokenInfoResponse.message}`
        );
        if (
          tokenInfoResponse.status === "1" &&
          tokenInfoResponse.result.length > 0
        ) {
          const tokenInfo: EtherscanTokenInfo = tokenInfoResponse.result[0];
          // Format the output nicely
          resultText =
            `Token Info for ${validatedArgs.contractaddress}:\n` +
            `Name: ${tokenInfo.tokenName}\n` +
            `Symbol: ${tokenInfo.symbol}\n` +
            `Type: ${tokenInfo.tokenType}\n` +
            `Decimals: ${tokenInfo.divisor}\n` +
            `Total Supply (raw): ${tokenInfo.totalSupply}\n` +
            `Website: ${tokenInfo.website || "N/A"}\n` +
            `Description: ${tokenInfo.description || "N/A"}\n` +
            `Price (USD): ${tokenInfo.tokenPriceUSD || "N/A"}`;
        } else {
          resultText = `Etherscan API Error or No Token Info Found (${toolName}): ${
            tokenInfoResponse.message || "API error or no data"
          } (Result: ${JSON.stringify(tokenInfoResponse.result)})`;
          console.error(
            `[Server:callTool][${toolName}] API Error/No Data Response:`,
            tokenInfoResponse
          );
        }
        break;
      // --- End Added Cases ---

      // --- Added Cases for Phase 5 ---
      case "etherscan_getTransactionReceiptStatus":
        const receiptStatusResponse: TxReceiptStatusResponse =
          await etherscanClient.getTransactionReceiptStatus(validatedArgs);
        // --- DEBUG LOGGING ---
        console.error(
          `[Server:callTool][${toolName}] Raw Response:`,
          JSON.stringify(receiptStatusResponse, null, 2)
        );
        // --- END DEBUG LOGGING ---
        console.error(
          `[Server:callTool][${toolName}] Etherscan API Status: ${receiptStatusResponse.status}, Message: ${receiptStatusResponse.message}`
        );
        if (receiptStatusResponse.status === "1") {
          // Access nested status carefully
          const status = receiptStatusResponse.result?.status; // Use optional chaining just in case result is null/undefined
          console.error(
            `[Server:callTool][${toolName}] Nested Status Value:`,
            status
          ); // Log the extracted status
          resultText = `Transaction Receipt Status for ${
            validatedArgs.txhash
          }: ${
            status === "1" ? "Success" : "Failed/Error"
          } (Status Code: ${status})`;
        } else {
          resultText = `Etherscan API Error (${toolName}): ${
            receiptStatusResponse.message || "Unknown API error"
          } (Result: ${JSON.stringify(receiptStatusResponse.result)})`;
          console.error(
            `[Server:callTool][${toolName}] API Error Response:`,
            receiptStatusResponse
          );
        }
        break;

      case "etherscan_getTransactionStatus":
        const execStatusResponse: TxExecutionStatusResponse =
          await etherscanClient.getTransactionStatus(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API Status: ${execStatusResponse.status}, Message: ${execStatusResponse.message}`
        );
        // Note: The 'status' field in the base response might indicate API call success/failure,
        // while 'result.isError' indicates the *transaction's* execution status.
        if (execStatusResponse.status === "1") {
          const isError = execStatusResponse.result.isError;
          const errDesc = execStatusResponse.result.errDescription;
          resultText = `Transaction Execution Status for ${
            validatedArgs.txhash
          }: ${isError === "0" ? "Success" : "Error"}${
            isError === "1" ? ` (Description: ${errDesc})` : ""
          }`;
        } else {
          // This case handles errors in the API call itself (e.g., invalid txhash format reported by Etherscan API)
          resultText = `Etherscan API Error (${toolName}): ${
            execStatusResponse.message || "Unknown API error"
          } (Result: ${JSON.stringify(execStatusResponse.result)})`;
          console.error(
            `[Server:callTool][${toolName}] API Error Response:`,
            execStatusResponse
          );
        }
        break;
      // --- End Added Cases ---

      // --- Added Case for Phase 6 ---
      case "etherscan_getLogs":
        const logsResponse: EtherscanGetLogsResponse =
          await etherscanClient.getLogs(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API Status: ${logsResponse.status}, Message: ${logsResponse.message}`
        );
        if (logsResponse.status === "1") {
          const logs = logsResponse.result;
          if (logs.length === 0) {
            resultText = `No logs found matching the specified criteria.`;
          } else {
            // Format log list concisely
            resultText =
              `Found ${logs.length} logs (latest ${
                logs.length < 5 ? logs.length : 5
              }):\n` +
              logs
                .slice(0, 5)
                .map(
                  (log) =>
                    `- TxHash: ${log.transactionHash.substring(
                      0,
                      10
                    )}... Address: ${log.address.substring(0, 10)}... Topics: ${
                      log.topics.length
                    }`
                )
                .join("\n");
            if (logs.length > 5) resultText += "\n... (more logs available)";
          }
        } else {
          resultText = `Etherscan API Error (${toolName}): ${
            logsResponse.message || "Unknown API error"
          } (Result: ${JSON.stringify(logsResponse.result)})`;
          console.error(
            `[Server:callTool][${toolName}] API Error Response:`,
            logsResponse
          );
        }
        break;
      // --- End Added Case ---

      default:
        // Log error to stderr
        console.error(
          `[Server:callTool] Logic error: Tool ${toolName} found but not handled in switch.`
        );
        throw new Error(
          `Internal Server Error: Tool ${toolName} handler not implemented.`
        );
    }

    // 4. Format and return success response
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
