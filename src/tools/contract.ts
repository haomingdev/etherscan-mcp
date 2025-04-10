import { z } from "zod";
import { McpToolDefinition } from "./account.js"; // Reuse the definition structure

// --- Schemas for Input Validation ---

// Re-use common schemas if defined elsewhere, or define locally
const EthereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format");

const ChainIdSchema = z
  .number()
  .int()
  .positive("Chain ID must be a positive integer");

const GetContractDataInputSchema = z.object({
  address: EthereumAddressSchema,
  chainId: ChainIdSchema,
});

// --- Tool Definitions ---

/**
 * MCP Tool Definition: Get Contract Source Code for Verified Contract Source Codes.
 * Corresponds to Etherscan API module=contract, action=getsourcecode.
 */
export const etherscan_getSourceCode_Def: McpToolDefinition = {
  name: "etherscan_getSourceCode",
  description: "Get the source code and metadata for a verified contract.",
  inputSchema: GetContractDataInputSchema,
};

/**
 * MCP Tool Definition: Get Contract ABI for Verified Contract Source Codes.
 * Corresponds to Etherscan API module=contract, action=getabi.
 */
export const etherscan_getAbi_Def: McpToolDefinition = {
  name: "etherscan_getAbi",
  description: "Get the ABI for a verified contract.",
  inputSchema: GetContractDataInputSchema,
};

// Array of all tool definition objects in this file
export const contractToolDefinitions: McpToolDefinition[] = [
  etherscan_getSourceCode_Def,
  etherscan_getAbi_Def,
];
