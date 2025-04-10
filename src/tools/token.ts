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

// Schema for actions requiring contract address and chainId
const GetTokenDataInputSchema = z.object({
  contractaddress: EthereumAddressSchema,
  chainId: ChainIdSchema,
});

// --- Tool Definitions ---

/**
 * MCP Tool Definition: Get ERC20-Token Total Supply by ContractAddress.
 * Corresponds to Etherscan API module=stats, action=tokensupply.
 */
export const etherscan_getTokenSupply_Def: McpToolDefinition = {
  name: "etherscan_getTokenSupply",
  description: "Get the total supply of an ERC20 token by contract address.",
  inputSchema: GetTokenDataInputSchema,
};

/**
 * MCP Tool Definition: Get information about a token by contract address.
 * Corresponds to Etherscan API module=token, action=tokeninfo.
 */
export const etherscan_getTokenInfo_Def: McpToolDefinition = {
  name: "etherscan_getTokenInfo",
  description: "Get information about a token by contract address.",
  inputSchema: GetTokenDataInputSchema,
};

// Array of all tool definition objects in this file
export const tokenToolDefinitions: McpToolDefinition[] = [
  etherscan_getTokenSupply_Def,
  etherscan_getTokenInfo_Def,
];
