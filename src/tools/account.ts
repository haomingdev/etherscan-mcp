import { z } from "zod";

// --- Schemas for Input Validation ---

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

const GetNormalTransactionsInputSchema = z.object({
  address: EthereumAddressSchema,
  chainId: ChainIdSchema,
  startblock: z.number().int().nonnegative().optional(),
  endblock: z.number().int().nonnegative().optional(),
  page: z.number().int().positive().optional(),
  offset: z.number().int().positive().optional(),
  sort: z.enum(["asc", "desc"]).optional(),
});

const GetInternalTransactionsInputSchema = z
  .object({
    address: EthereumAddressSchema.optional(),
    txhash: z
      .string()
      .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid Transaction hash format")
      .optional(),
    chainId: ChainIdSchema,
    startblock: z.number().int().nonnegative().optional(),
    endblock: z.number().int().nonnegative().optional(),
    page: z.number().int().positive().optional(),
    offset: z.number().int().positive().optional(),
    sort: z.enum(["asc", "desc"]).optional(),
  })
  .refine((data) => !!data.address || !!data.txhash, {
    message: "Either 'address' or 'txhash' must be provided",
    path: ["address"], // Report error on the first optional field
  });

const GetTokenTransfersInputSchema = z
  .object({
    address: EthereumAddressSchema.optional(),
    contractaddress: EthereumAddressSchema.optional(), // Etherscan uses 'contractaddress'
    chainId: ChainIdSchema,
    startblock: z.number().int().nonnegative().optional(),
    endblock: z.number().int().nonnegative().optional(),
    page: z.number().int().positive().optional(),
    offset: z.number().int().positive().optional(),
    sort: z.enum(["asc", "desc"]).optional(),
  })
  .refine((data) => !!data.address || !!data.contractaddress, {
    message: "Either 'address' or 'contractaddress' must be provided",
    path: ["address"], // Report error on the first optional field
  });

const GetMinedBlocksInputSchema = z.object({
  address: EthereumAddressSchema,
  chainId: ChainIdSchema,
  blocktype: z.enum(["blocks", "uncles"]).optional(),
  page: z.number().int().positive().optional(),
  offset: z.number().int().positive().optional(),
});

// Schema for Get Multiple Balances
const GetMultiBalanceInputSchema = z.object({
  // Etherscan API expects comma-separated string, but array is better for tool input schema.
  // We'll join the array in the handler before calling the client.
  addresses: z
    .array(EthereumAddressSchema)
    .min(1, "At least one address is required"),
  chainId: ChainIdSchema,
});

// --- Tool Definitions (as plain objects) ---

// Define the structure for our tool definitions
export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny; // Changed to accept any Zod schema type
}

/**
 * MCP Tool Definition: Get Ether Balance for a single address.
 * Corresponds to Etherscan API module=account, action=balance.
 */
export const etherscan_getBalance_Def: McpToolDefinition = {
  name: "etherscan_getBalance",
  description:
    "Get the Ether balance for a single address on a specific chain.",
  inputSchema: GetBalanceInputSchema,
};

/**
 * MCP Tool Definition: Get a list of 'Normal' Transactions By Address.
 * Corresponds to Etherscan API module=account, action=txlist.
 */
export const etherscan_getNormalTransactions_Def: McpToolDefinition = {
  name: "etherscan_getNormalTransactions",
  description:
    "Get a list of normal transactions for a given address, with optional pagination and sorting.",
  inputSchema: GetNormalTransactionsInputSchema,
};

/**
 * MCP Tool Definition: Get Ether balance for multiple addresses.
 * Corresponds to Etherscan API module=account, action=balancemulti.
 */
export const etherscan_getMultiBalance_Def: McpToolDefinition = {
  name: "etherscan_getMultiBalance",
  description:
    "Get the Ether balance for multiple addresses on a specific chain in a single call.",
  inputSchema: GetMultiBalanceInputSchema,
};

/**
 * MCP Tool Definition: Get a list of internal transactions by address or transaction hash.
 * Corresponds to Etherscan API module=account, action=txlistinternal.
 */
export const etherscan_getInternalTransactions_Def: McpToolDefinition = {
  name: "etherscan_getInternalTransactions",
  description:
    "Get a list of internal transactions by address or transaction hash, with optional pagination and sorting.",
  inputSchema: GetInternalTransactionsInputSchema,
};

/**
 * MCP Tool Definition: Get ERC20/ERC721/ERC1155 token transfers for an address or contract.
 * Corresponds to Etherscan API module=account, action=tokentx (and potentially others).
 */
export const etherscan_getTokenTransfers_Def: McpToolDefinition = {
  name: "etherscan_getTokenTransfers",
  description:
    "Get ERC20/ERC721/ERC1155 token transfers for an address or contract, with optional pagination and sorting. Defaults to ERC20-like behavior (action=tokentx).",
  inputSchema: GetTokenTransfersInputSchema,
};

/**
 * MCP Tool Definition: Get a list of blocks validated by a specific address.
 * Corresponds to Etherscan API module=account, action=getminedblocks.
 */
export const etherscan_getMinedBlocks_Def: McpToolDefinition = {
  name: "etherscan_getMinedBlocks",
  description:
    "Get a list of blocks validated by a specific address, with optional pagination.",
  inputSchema: GetMinedBlocksInputSchema,
};

// --- Updated Array of All Tool Definitions ---
// Re-declare the array to include the new definitions
export const accountToolDefinitions: McpToolDefinition[] = [
  etherscan_getBalance_Def,
  etherscan_getNormalTransactions_Def,
  etherscan_getMultiBalance_Def,
  etherscan_getInternalTransactions_Def, // Added
  etherscan_getTokenTransfers_Def, // Added
  etherscan_getMinedBlocks_Def, // Added
];
