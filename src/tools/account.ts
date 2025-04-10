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

// --- Tool Definitions (as plain objects) ---

// Define the structure for our tool definitions
export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any, any>; // Use a base ZodObject type
}

export const etherscan_getBalance_Def: McpToolDefinition = {
  name: "etherscan_getBalance",
  description:
    "Get the Ether balance for a single address on a specific chain.",
  inputSchema: GetBalanceInputSchema,
};

export const etherscan_getNormalTransactions_Def: McpToolDefinition = {
  name: "etherscan_getNormalTransactions",
  description:
    "Get a list of normal transactions for a given address, with optional pagination and sorting.",
  inputSchema: GetNormalTransactionsInputSchema,
};

// Array of all tool definition objects in this file
export const accountToolDefinitions: McpToolDefinition[] = [
  etherscan_getBalance_Def,
  etherscan_getNormalTransactions_Def,
];
