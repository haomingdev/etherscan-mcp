import { z } from "zod";

// --- Zod Schemas for Input Validation ---

// Reusable base schema
const ChainIdSchema = z.object({
  chainId: z.number().int().positive("Chain ID must be a positive integer"),
});

// Reusable schemas for common parameters
const TagSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]+$|^latest$|^pending$|^earliest$/, {
    message:
      "Invalid block tag. Must be hex block number (0x...), 'latest', 'pending', or 'earliest'.",
  })
  .describe(
    "Block tag: hex block number (e.g., '0x10d4f'), 'latest', 'pending', or 'earliest'."
  );

const BooleanSchema = z
  .boolean()
  .describe(
    "Boolean flag: true to return full transaction objects, false to return only hashes."
  );

const TxHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash format.")
  .describe("Transaction hash (32-byte hex string starting with 0x).");

const IndexSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]+$/, "Invalid index format. Must be hex (0x...).")
  .describe("Hexadecimal index (e.g., '0x0').");

const AddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format.")
  .describe("Ethereum address (20-byte hex string starting with 0x).");

const HexDataSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]*$/, "Invalid hex data format.") // Allows '0x' for empty data
  .describe("Hexadecimal encoded data string (starting with 0x).");

const HexValueSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]+$/, "Invalid hex value format.")
  .describe("Hexadecimal encoded value string (e.g., '0x12a05f200').");

const HexPositionSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]+$/, "Invalid hex position format.")
  .describe("Hexadecimal encoded storage position (e.g., '0x0').");

// Specific schemas for each tool
const EthBlockNumberInputSchema = ChainIdSchema;

const EthGetBlockByNumberInputSchema = ChainIdSchema.extend({
  tag: TagSchema,
  boolean: BooleanSchema,
});

const EthGetBlockTransactionCountByNumberInputSchema = ChainIdSchema.extend({
  tag: TagSchema,
});

const EthGetTransactionByHashInputSchema = ChainIdSchema.extend({
  txhash: TxHashSchema,
});

const EthGetTransactionByBlockNumberAndIndexInputSchema = ChainIdSchema.extend({
  tag: TagSchema,
  index: IndexSchema,
});

const EthGetTransactionCountInputSchema = ChainIdSchema.extend({
  address: AddressSchema,
  tag: TagSchema,
});

const EthSendRawTransactionInputSchema = ChainIdSchema.extend({
  hex: HexDataSchema.describe(
    "Signed transaction data in HEX format (starting with 0x)."
  ),
});

const EthGetTransactionReceiptInputSchema = ChainIdSchema.extend({
  txhash: TxHashSchema,
});

const EthCallInputSchema = ChainIdSchema.extend({
  to: AddressSchema.describe("Address to execute the call against."),
  data: HexDataSchema.describe(
    "Hex encoded data (e.g., function selector and arguments)."
  ),
  tag: TagSchema,
});

const EthGetCodeInputSchema = ChainIdSchema.extend({
  address: AddressSchema,
  tag: TagSchema,
});

const EthGetStorageAtInputSchema = ChainIdSchema.extend({
  address: AddressSchema,
  position: HexPositionSchema,
  tag: TagSchema,
});

const EthGasPriceInputSchema = ChainIdSchema;

const EthEstimateGasInputSchema = ChainIdSchema.extend({
  to: AddressSchema,
  value: HexValueSchema.describe("Value in wei (hex)."),
  gasPrice: HexValueSchema.optional().describe(
    "Gas price in wei (hex, optional, legacy)."
  ),
  gas: HexValueSchema.optional().describe("Gas limit (hex, optional)."),
  data: HexDataSchema.optional().describe("Hex encoded data (optional)."),
});

// --- Tool Definition Interface (matching log.ts pattern) ---
interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
}

// --- Tool Definitions ---

/**
 * MCP Tool Definition: Get the number of the most recent block.
 * Corresponds to Etherscan API module=proxy, action=eth_blockNumber.
 */
export const ethBlockNumberTool: McpToolDefinition = {
  name: "etherscan_eth_blockNumber",
  description: "Get the number of the most recent block.",
  inputSchema: EthBlockNumberInputSchema,
};

/**
 * MCP Tool Definition: Get information about a block by block number.
 * Corresponds to Etherscan API module=proxy, action=eth_getBlockByNumber.
 */
export const ethGetBlockByNumberTool: McpToolDefinition = {
  name: "etherscan_eth_getBlockByNumber",
  description: "Get information about a block by block number.",
  inputSchema: EthGetBlockByNumberInputSchema,
};

/**
 * MCP Tool Definition: Get the number of transactions in a specific block.
 * Corresponds to Etherscan API module=proxy, action=eth_getBlockTransactionCountByNumber.
 */
export const ethGetBlockTransactionCountByNumberTool: McpToolDefinition = {
  name: "etherscan_eth_getBlockTransactionCountByNumber",
  description: "Get the number of transactions in a specific block.",
  inputSchema: EthGetBlockTransactionCountByNumberInputSchema,
};

/**
 * MCP Tool Definition: Get information about a transaction by hash.
 * Corresponds to Etherscan API module=proxy, action=eth_getTransactionByHash.
 */
export const ethGetTransactionByHashTool: McpToolDefinition = {
  name: "etherscan_eth_getTransactionByHash",
  description: "Get information about a transaction by hash.",
  inputSchema: EthGetTransactionByHashInputSchema,
};

/**
 * MCP Tool Definition: Get information about a transaction by block number and index.
 * Corresponds to Etherscan API module=proxy, action=eth_getTransactionByBlockNumberAndIndex.
 */
export const ethGetTransactionByBlockNumberAndIndexTool: McpToolDefinition = {
  name: "etherscan_eth_getTransactionByBlockNumberAndIndex",
  description: "Get information about a transaction by block number and index.",
  inputSchema: EthGetTransactionByBlockNumberAndIndexInputSchema,
};

/**
 * MCP Tool Definition: Get the number of transactions sent from an address.
 * Corresponds to Etherscan API module=proxy, action=eth_getTransactionCount.
 */
export const ethGetTransactionCountTool: McpToolDefinition = {
  name: "etherscan_eth_getTransactionCount",
  description: "Get the number of transactions sent from an address.",
  inputSchema: EthGetTransactionCountInputSchema,
};

/**
 * MCP Tool Definition: Submit a pre-signed transaction to the network (via POST).
 * Corresponds to Etherscan API module=proxy, action=eth_sendRawTransaction.
 */
export const ethSendRawTransactionTool: McpToolDefinition = {
  name: "etherscan_eth_sendRawTransaction",
  description: "Submit a pre-signed transaction to the network (via POST).",
  inputSchema: EthSendRawTransactionInputSchema,
};

/**
 * MCP Tool Definition: Get the receipt of a transaction by hash.
 * Corresponds to Etherscan API module=proxy, action=eth_getTransactionReceipt.
 */
export const ethGetTransactionReceiptTool: McpToolDefinition = {
  name: "etherscan_eth_getTransactionReceipt",
  description: "Get the receipt of a transaction by hash.",
  inputSchema: EthGetTransactionReceiptInputSchema,
};

/**
 * MCP Tool Definition: Execute a message call immediately without creating a transaction.
 * Corresponds to Etherscan API module=proxy, action=eth_call.
 */
export const ethCallTool: McpToolDefinition = {
  name: "etherscan_eth_call",
  description:
    "Execute a message call immediately without creating a transaction.",
  inputSchema: EthCallInputSchema,
};

/**
 * MCP Tool Definition: Get the code at a given address.
 * Corresponds to Etherscan API module=proxy, action=eth_getCode.
 */
export const ethGetCodeTool: McpToolDefinition = {
  name: "etherscan_eth_getCode",
  description: "Get the code at a given address.",
  inputSchema: EthGetCodeInputSchema,
};

/**
 * MCP Tool Definition: Get the value from a storage position at a given address.
 * Corresponds to Etherscan API module=proxy, action=eth_getStorageAt.
 */
export const ethGetStorageAtTool: McpToolDefinition = {
  name: "etherscan_eth_getStorageAt",
  description: "Get the value from a storage position at a given address.",
  inputSchema: EthGetStorageAtInputSchema,
};

/**
 * MCP Tool Definition: Get the current price per gas in wei.
 * Corresponds to Etherscan API module=proxy, action=eth_gasPrice.
 */
export const ethGasPriceTool: McpToolDefinition = {
  name: "etherscan_eth_gasPrice",
  description: "Get the current price per gas in wei.",
  inputSchema: EthGasPriceInputSchema,
};

/**
 * MCP Tool Definition: Estimate the gas needed for a transaction without executing it.
 * Corresponds to Etherscan API module=proxy, action=eth_estimateGas.
 */
export const ethEstimateGasTool: McpToolDefinition = {
  name: "etherscan_eth_estimateGas",
  description:
    "Estimate the gas needed for a transaction without executing it.",
  inputSchema: EthEstimateGasInputSchema,
};

// --- Add other Geth/Proxy tool definitions below ---

// Export all tools from this file
export const proxyTools: McpToolDefinition[] = [
  ethBlockNumberTool,
  ethGetBlockByNumberTool,
  ethGetBlockTransactionCountByNumberTool,
  ethGetTransactionByHashTool,
  ethGetTransactionByBlockNumberAndIndexTool,
  ethGetTransactionCountTool,
  ethSendRawTransactionTool,
  ethGetTransactionReceiptTool,
  ethCallTool,
  ethGetCodeTool,
  ethGetStorageAtTool,
  ethGasPriceTool,
  ethEstimateGasTool,
];
