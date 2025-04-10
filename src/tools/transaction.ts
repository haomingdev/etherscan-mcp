import { z } from "zod";
import { McpToolDefinition } from "./account.js"; // Import the shared interface

// --- Schemas for Input Validation ---

const TxHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid Transaction hash format");

const ChainIdSchema = z
  .number()
  .int()
  .positive("Chain ID must be a positive integer");

// Define the input schema for getTransactionReceiptStatus using Zod
const GetTxReceiptStatusInputSchema = z.object({
  txhash: TxHashSchema,
  chainId: ChainIdSchema,
});

/**
 * MCP Tool Definition: Get Transaction Receipt Status (Post-Byzantium).
 * Corresponds to Etherscan API module=transaction, action=gettxreceiptstatus.
 */
export const etherscan_getTransactionReceiptStatus_Def: McpToolDefinition = {
  name: "etherscan_getTransactionReceiptStatus",
  description:
    "Get the status code of a transaction receipt by transaction hash (post-Byzantium). Status '1' = Success, '0' = Failed.",
  inputSchema: GetTxReceiptStatusInputSchema,
};

// Define the input schema for getTransactionStatus (Execution Status) using Zod
const GetTxExecutionStatusInputSchema = z.object({
  txhash: TxHashSchema,
  chainId: ChainIdSchema,
});

/**
 * MCP Tool Definition: Check Transaction Execution Status.
 * Corresponds to Etherscan API module=transaction, action=getstatus.
 */
export const etherscan_getTransactionStatus_Def: McpToolDefinition = {
  name: "etherscan_getTransactionStatus",
  description:
    "Check the execution status of a transaction by transaction hash. Status '0' = No Error, '1' = Error.",
  inputSchema: GetTxExecutionStatusInputSchema,
};

// Array containing all tool definitions for this module
export const transactionToolDefinitions: McpToolDefinition[] = [
  etherscan_getTransactionReceiptStatus_Def,
  etherscan_getTransactionStatus_Def,
];
