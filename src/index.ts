#!/usr/bin/env node

import dotenv from "dotenv";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError, // Added
  ErrorCode, // Added
} from "@modelcontextprotocol/sdk/types.js";
import {
  EtherscanClient,
  EtherscanError, // Import custom error if needed for specific checks
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
  // --- Geth/Proxy Types ---
  EtherscanHexStringResponse,
  EtherscanGetBlockByNumberResponse,
  EtherscanGetTransactionByHashResponse,
  EtherscanGetTransactionByBlockNumberAndIndexResponse,
  EtherscanGetTransactionReceiptResponse,
  EtherscanSendRawTransactionResponse,
  EtherscanEstimateGasResponse,
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
import { proxyTools } from "./tools/proxy.js"; // Added import for proxy tools
import { agentToolDefinitions } from "./tools/agent.js"; // Added for Agent tool
import { runAgentTask } from "./agent/agent.js"; // Added for Agent logic
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai"; // Added for Agent
// Removed gasTools import
// Removed statsTools import

// Combine all tool definitions
const allToolDefinitions = [
  ...accountToolDefinitions,
  ...contractToolDefinitions,
  ...tokenToolDefinitions,
  ...transactionToolDefinitions, // Added transaction tools
  ...logTools, // Added log tools
  ...proxyTools, // Added proxy tools
  ...agentToolDefinitions, // Added agent tool
  // Removed gasTools from array
  // Removed statsTools from array
];

// Load environment variables from .env file
dotenv.config();

// --- Configuration ---
const etherscanApiKey = process.env.ETHERSCAN_API_KEY; // Renamed
if (!etherscanApiKey) {
  console.error("FATAL: ETHERSCAN_API_KEY environment variable not set.");
  process.exit(1);
}
const googleApiKey = process.env.GOOGLE_API_KEY; // Added for Agent
if (!googleApiKey) {
  // Added for Agent
  console.error("FATAL: GOOGLE_API_KEY environment variable not set."); // Added for Agent
  process.exit(1); // Added for Agent
}

// --- Initialize Etherscan Client ---
let etherscanClient: EtherscanClient;
try {
  etherscanClient = new EtherscanClient(etherscanApiKey); // Use renamed variable
  console.error("[Setup] EtherscanClient initialized successfully."); // Log to stderr
} catch (error: any) {
  console.error("[Setup] Failed to initialize EtherscanClient:", error.message); // Log to stderr
  process.exit(1);
}

// --- Initialize Google Gemini Model --- (New Block)
let geminiModel: GenerativeModel;
try {
  const genAI = new GoogleGenerativeAI(googleApiKey);
  // Use the model name provided by the user
  geminiModel = genAI.getGenerativeModel({
    model: "gemini-2.5-pro-preview-03-25",
  }); // Updated model name as requested
  console.error("[Setup] Google Gemini Model initialized successfully."); // Log to stderr
} catch (error: any) {
  console.error(
    "[Setup] Failed to initialize Google Gemini Model:",
    error.message
  ); // Log to stderr
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
    // Throw McpError for method not found
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
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
    // Throw McpError for invalid parameters
    throw new McpError(
      ErrorCode.InvalidParams,
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
      | EtherscanGetLogsResponse // Added for logs
      // --- Geth/Proxy Responses ---
      | EtherscanHexStringResponse
      | EtherscanGetBlockByNumberResponse
      | EtherscanGetTransactionByHashResponse
      | EtherscanGetTransactionByBlockNumberAndIndexResponse
      | EtherscanGetTransactionReceiptResponse
      | EtherscanSendRawTransactionResponse
      | EtherscanEstimateGasResponse
      | string; // Added string for agent response
    let resultText: string;

    // --- Execute Tool Logic ---
    // Use a switch statement to route to the correct client method or agent function
    switch (toolName) {
      // --- Agent Case ---
      case "etherscan_runAgentTask":
        console.error(`[Server:callTool][${toolName}] Invoking agent task...`);
        // Directly call the agent function, passing necessary clients/models
        resultText = await runAgentTask(
          validatedArgs.prompt,
          etherscanClient,
          geminiModel
        );
        console.error(`[Server:callTool][${toolName}] Agent task completed.`);
        // Agent returns the final text string directly
        break;

      // --- Standard Etherscan Tool Cases ---
      case "etherscan_getBalance":
        responseData = await etherscanClient.getBalance(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
        resultText = `Balance for ${validatedArgs.address} (Chain ${validatedArgs.chainId}): ${responseData.result} wei`;
        break;

      case "etherscan_getNormalTransactions":
        const response: EtherscanTxListResponse =
          await etherscanClient.getNormalTransactions(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
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
        break;

      case "etherscan_getMultiBalance":
        const multiBalanceResponse: MultiBalanceApiResponse =
          await etherscanClient.getMultiBalance(
            validatedArgs.addresses,
            validatedArgs.chainId
          );
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
        const balances = multiBalanceResponse.result;
        const output = balances.map((balance: MultiBalanceResponseItem) => ({
          // Add type for 'balance'
          account: balance.account,
          balance: balance.balance,
        }));
        resultText = JSON.stringify(output, null, 2);
        break;

      // --- Added Cases for Phase 2B ---
      case "etherscan_getInternalTransactions":
        const internalTxResponse: EtherscanInternalTxListResponse =
          await etherscanClient.getInternalTransactions(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
        const internalTxs = internalTxResponse.result;
        if (internalTxs.length === 0) {
          resultText = `No internal transactions found for the specified parameters.`;
        } else {
          resultText =
            `Found ${internalTxs.length} internal transactions (latest ${
              internalTxs.length < 5 ? internalTxs.length : 5
            }):\n` +
            internalTxs
              .slice(0, 5)
              .map(
                (tx: EtherscanInternalTransaction) =>
                  `- From: ${tx.from.substring(0, 10)}... To: ${tx.to.substring(
                    0,
                    10
                  )}... Value: ${
                    tx.value
                  } wei (Parent Hash: ${tx.hash.substring(0, 10)}...)`
              )
              .join("\n");
          if (internalTxs.length > 5)
            resultText += "\n... (more transactions available)";
        }
        break;

      case "etherscan_getTokenTransfers":
        const tokenTxResponse: EtherscanTokenTxResponse =
          await etherscanClient.getTokenTransfers(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
        const tokenTxs = tokenTxResponse.result;
        if (tokenTxs.length === 0) {
          resultText = `No token transfers found for the specified parameters.`;
        } else {
          resultText =
            `Found ${tokenTxs.length} token transfers (latest ${
              tokenTxs.length < 5 ? tokenTxs.length : 5
            }):\n` +
            tokenTxs
              .slice(0, 5)
              .map(
                (tx: EtherscanTokenTransfer) =>
                  `- Token: ${tx.tokenSymbol} (${
                    tx.tokenName
                  }) From: ${tx.from.substring(0, 10)}... To: ${tx.to.substring(
                    0,
                    10
                  )}... Value/ID: ${tx.value} (Hash: ${tx.hash.substring(
                    0,
                    10
                  )}...)`
              )
              .join("\n");
          if (tokenTxs.length > 5)
            resultText += "\n... (more transfers available)";
        }
        break;

      case "etherscan_getMinedBlocks":
        const minedBlocksResponse: EtherscanMinedBlocksResponse =
          await etherscanClient.getMinedBlocks(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
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
          if (blocks.length > 5) resultText += "\n... (more blocks available)";
        }
        break;
      // --- End Added Cases ---

      // --- Added Cases for Phase 3 ---
      case "etherscan_getSourceCode":
        const sourceCodeResponse: EtherscanGetSourceCodeResponse =
          await etherscanClient.getSourceCode(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
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
        break;

      case "etherscan_getAbi":
        const abiResponse: EtherscanGetAbiResponse =
          await etherscanClient.getAbi(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
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
        break;
      // --- End Added Cases ---

      // --- Added Cases for Phase 4 ---
      case "etherscan_getTokenSupply":
        const tokenSupplyResponse: EtherscanTokenSupplyResponse =
          await etherscanClient.getTokenSupply(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
        resultText = `Total supply for ${validatedArgs.contractaddress}: ${tokenSupplyResponse.result}`;
        // Note: Handler doesn't know decimals here, returning raw supply string. Client might need to fetch decimals separately.
        break;

      case "etherscan_getTokenInfo":
        const tokenInfoResponse: EtherscanTokenInfoResponse =
          await etherscanClient.getTokenInfo(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
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
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
        // Access nested status carefully
        const status = receiptStatusResponse.result?.status; // Use optional chaining just in case result is null/undefined
        console.error(
          `[Server:callTool][${toolName}] Nested Status Value:`,
          status
        ); // Log the extracted status
        resultText = `Transaction Receipt Status for ${validatedArgs.txhash}: ${
          status === "1" ? "Success" : "Failed/Error"
        } (Status Code: ${status})`;
        break;

      case "etherscan_getTransactionStatus":
        const execStatusResponse: TxExecutionStatusResponse =
          await etherscanClient.getTransactionStatus(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
        // Note: The 'status' field in the base response might indicate API call success/failure,
        // while 'result.isError' indicates the *transaction's* execution status.
        const isError = execStatusResponse.result.isError;
        const errDesc = execStatusResponse.result.errDescription;
        resultText = `Transaction Execution Status for ${
          validatedArgs.txhash
        }: ${isError === "0" ? "Success" : "Error"}${
          isError === "1" ? ` (Description: ${errDesc})` : ""
        }`;
        break;
      // --- End Added Cases ---

      // --- Added Case for Phase 6 ---
      case "etherscan_getLogs":
        const logsResponse: EtherscanGetLogsResponse =
          await etherscanClient.getLogs(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
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
        break;
      // --- End Added Case ---

      // --- Added Cases for Phase 7 (Geth/Proxy) ---
      case "etherscan_eth_blockNumber":
        const blockNumResponse: EtherscanHexStringResponse =
          await etherscanClient.eth_blockNumber(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
        resultText = `Latest Block Number (Chain ${validatedArgs.chainId}): ${blockNumResponse.result} (Hex)`;
        break;

      case "etherscan_eth_getBlockByNumber":
        const blockResponse: EtherscanGetBlockByNumberResponse =
          await etherscanClient.eth_getBlockByNumber(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
        if (blockResponse.result) {
          // Format block data concisely
          resultText =
            `Block ${blockResponse.result.number} Info (Chain ${validatedArgs.chainId}):\n` +
            `Hash: ${blockResponse.result.hash.substring(0, 15)}...\n` +
            `Timestamp: ${new Date(
              parseInt(blockResponse.result.timestamp, 16) * 1000
            ).toLocaleString()}\n` +
            `Miner: ${blockResponse.result.miner.substring(0, 15)}...\n` +
            `Gas Used: ${parseInt(blockResponse.result.gasUsed, 16)}\n` +
            `Transactions: ${blockResponse.result.transactions.length}`;
        } else {
          resultText = `Block ${validatedArgs.tag} not found on chain ${validatedArgs.chainId}.`;
        }
        break;

      case "etherscan_eth_getBlockTransactionCountByNumber":
        const blockTxCountResponse: EtherscanHexStringResponse =
          await etherscanClient.eth_getBlockTransactionCountByNumber(
            validatedArgs
          );
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
        resultText = `Transaction Count in Block ${validatedArgs.tag} (Chain ${
          validatedArgs.chainId
        }): ${parseInt(blockTxCountResponse.result, 16)}`;
        break;

      case "etherscan_eth_getTransactionByHash":
        const txByHashResponse: EtherscanGetTransactionByHashResponse =
          await etherscanClient.eth_getTransactionByHash(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
        if (txByHashResponse.result) {
          // Format tx data concisely
          resultText =
            `Transaction ${txByHashResponse.result.hash.substring(
              0,
              15
            )}... Info (Chain ${validatedArgs.chainId}):\n` +
            `Block: ${txByHashResponse.result.blockNumber}\n` +
            `From: ${txByHashResponse.result.from.substring(0, 15)}...\n` +
            `To: ${
              txByHashResponse.result.to
                ? txByHashResponse.result.to.substring(0, 15) + "..."
                : "Contract Creation"
            }\n` +
            `Value: ${parseInt(txByHashResponse.result.value, 16)} wei`;
        } else {
          resultText = `Transaction ${validatedArgs.txhash} not found on chain ${validatedArgs.chainId}.`;
        }
        break;

      case "etherscan_eth_getTransactionByBlockNumberAndIndex":
        const txByBlockIndexResponse: EtherscanGetTransactionByBlockNumberAndIndexResponse =
          await etherscanClient.eth_getTransactionByBlockNumberAndIndex(
            validatedArgs
          );
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
        if (txByBlockIndexResponse.result) {
          // Format tx data concisely
          resultText =
            `Transaction at Index ${validatedArgs.index} in Block ${validatedArgs.tag} (Chain ${validatedArgs.chainId}):\n` +
            `Hash: ${txByBlockIndexResponse.result.hash.substring(
              0,
              15
            )}...\n` +
            `From: ${txByBlockIndexResponse.result.from.substring(
              0,
              15
            )}...\n` +
            `To: ${
              txByBlockIndexResponse.result.to
                ? txByBlockIndexResponse.result.to.substring(0, 15) + "..."
                : "Contract Creation"
            }\n` +
            `Value: ${parseInt(txByBlockIndexResponse.result.value, 16)} wei`;
        } else {
          resultText = `Transaction at index ${validatedArgs.index} in block ${validatedArgs.tag} not found on chain ${validatedArgs.chainId}.`;
        }
        break;

      case "etherscan_eth_getTransactionCount":
        const txCountResponse: EtherscanHexStringResponse =
          await etherscanClient.eth_getTransactionCount(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
        resultText = `Transaction Count for ${validatedArgs.address} at ${
          validatedArgs.tag
        } (Chain ${validatedArgs.chainId}): ${parseInt(
          txCountResponse.result,
          16
        )}`;
        break;

      case "etherscan_eth_sendRawTransaction":
        const sendRawTxResponse: EtherscanSendRawTransactionResponse =
          await etherscanClient.eth_sendRawTransaction(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
        resultText = `Raw transaction submitted successfully (Chain ${validatedArgs.chainId}). Result (likely Tx Hash): ${sendRawTxResponse.result}`;
        break;

      case "etherscan_eth_getTransactionReceipt":
        const receiptResponse: EtherscanGetTransactionReceiptResponse =
          await etherscanClient.eth_getTransactionReceipt(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
        if (receiptResponse.result) {
          // Format receipt data concisely
          resultText =
            `Transaction Receipt for ${receiptResponse.result.transactionHash.substring(
              0,
              15
            )}... (Chain ${validatedArgs.chainId}):\n` +
            `Block: ${receiptResponse.result.blockNumber}\n` +
            `Status: ${
              receiptResponse.result.status === "0x1" ? "Success" : "Failed"
            }\n` +
            `Gas Used: ${parseInt(receiptResponse.result.gasUsed, 16)}\n` +
            `Logs: ${receiptResponse.result.logs.length}`;
        } else {
          resultText = `Transaction receipt for ${validatedArgs.txhash} not found on chain ${validatedArgs.chainId}.`;
        }
        break;

      case "etherscan_eth_call":
        const callResponse: EtherscanHexStringResponse =
          await etherscanClient.eth_call(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
        resultText = `Result of eth_call to ${validatedArgs.to} at ${validatedArgs.tag} (Chain ${validatedArgs.chainId}): ${callResponse.result}`;
        break;

      case "etherscan_eth_getCode":
        const codeResponse: EtherscanHexStringResponse =
          await etherscanClient.eth_getCode(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
        resultText = `Code at ${validatedArgs.address} at ${
          validatedArgs.tag
        } (Chain ${validatedArgs.chainId}): ${
          codeResponse.result.length > 100
            ? codeResponse.result.substring(0, 100) + "..."
            : codeResponse.result
        }`; // Truncate long code
        break;

      case "etherscan_eth_getStorageAt":
        const storageResponse: EtherscanHexStringResponse =
          await etherscanClient.eth_getStorageAt(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
        resultText = `Storage at position ${validatedArgs.position} for ${validatedArgs.address} at ${validatedArgs.tag} (Chain ${validatedArgs.chainId}): ${storageResponse.result}`;
        break;

      case "etherscan_eth_gasPrice":
        const gasPriceResponse: EtherscanHexStringResponse =
          await etherscanClient.eth_gasPrice(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
        resultText = `Current Gas Price (Chain ${validatedArgs.chainId}): ${gasPriceResponse.result} (Hex Wei)`;
        break;

      case "etherscan_eth_estimateGas":
        const estimateGasResponse: EtherscanEstimateGasResponse =
          await etherscanClient.eth_estimateGas(validatedArgs);
        console.error(
          `[Server:callTool][${toolName}] Etherscan API call successful.`
        );
        resultText = `Estimated Gas for call to ${validatedArgs.to} (Chain ${validatedArgs.chainId}): ${estimateGasResponse.result} (Hex)`;
        break;
      // --- End Added Cases ---

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
    // Catch errors and wrap them in McpError
    // Check if it's already an McpError or our custom EtherscanError
    if (error instanceof McpError) {
      // Re-throw McpErrors directly
      throw error;
    } else if (error instanceof EtherscanError) {
      // Wrap EtherscanError (API or client logic errors) in InternalError
      throw new McpError(
        ErrorCode.InternalError,
        `Etherscan Client Error (${toolName}): ${error.message}`
      );
    } else {
      // Wrap other unexpected errors
      throw new McpError(
        ErrorCode.InternalError,
        `Unexpected error executing tool ${toolName}: ${
          error.message || "An unknown error occurred"
        }`
      );
    }
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
