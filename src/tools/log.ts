import { z } from "zod";
import { EtherscanClient, EtherscanError } from "../utils/client.js";
import { EtherscanGetLogsResponse } from "../utils/types.js";
// Note: ToolDefinition from @modelcontextprotocol/sdk is not used here,
// as index.ts uses a custom McpToolDefinition interface with Zod schemas.

// --- Zod Schemas ---

// Reusable Zod schemas (similar to what might have been in commonSchemas)
const EthereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
  .optional(); // Making optional as it's not always required for logs

const ChainIdSchema = z
  .number()
  .int()
  .positive("Chain ID must be a positive integer");

const BlockParamSchema = z
  .union([z.number().int().nonnegative(), z.literal("latest")])
  .optional();

const TopicSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid Topic format (must be 32-byte hex)")
  .optional();

const TopicOperatorSchema = z.enum(["and", "or"]).optional();

const PageSchema = z.number().int().positive().optional();
const OffsetSchema = z.number().int().positive().optional();

// Input schema for the getLogs tool using Zod
const GetLogsInputSchema = z.object({
  chainId: ChainIdSchema,
  fromBlock: BlockParamSchema.describe("Starting block number or 'latest'."),
  toBlock: BlockParamSchema.describe("Ending block number or 'latest'."),
  address: EthereumAddressSchema.describe(
    "Contract address to filter logs by."
  ),
  topic0: TopicSchema.describe("Topic 0 filter."),
  topic1: TopicSchema.describe("Topic 1 filter."),
  topic2: TopicSchema.describe("Topic 2 filter."),
  topic3: TopicSchema.describe("Topic 3 filter."),
  topic0_1_opr: TopicOperatorSchema.describe(
    "Operator between topic0 and topic1."
  ),
  topic1_2_opr: TopicOperatorSchema.describe(
    "Operator between topic1 and topic2."
  ),
  topic2_3_opr: TopicOperatorSchema.describe(
    "Operator between topic2 and topic3."
  ),
  topic0_2_opr: TopicOperatorSchema.describe(
    "Operator between topic0 and topic2."
  ),
  topic0_3_opr: TopicOperatorSchema.describe(
    "Operator between topic0 and topic3."
  ),
  topic1_3_opr: TopicOperatorSchema.describe(
    "Operator between topic1 and topic3."
  ),
  page: PageSchema,
  offset: OffsetSchema,
});

// --- Tool Definition ---

// Define the structure expected by index.ts
interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
}

// Define an interface for the context expected by the tool execution
// This isn't strictly needed here if index.ts handles execution, but good practice
interface ToolContext {
  etherscanClient: EtherscanClient;
}

// Define an interface for the parameters based on the Zod schema
// (useful for type safety within the execute function if it were here)
type GetLogsParams = z.infer<typeof GetLogsInputSchema>;

/**
 * MCP Tool Definition: Get event logs matching specified criteria.
 * Corresponds to Etherscan API module=logs, action=getLogs.
 */
export const getLogsTool: McpToolDefinition = {
  name: "etherscan_getLogs",
  description:
    "Get event logs matching specified criteria (block range, address, topics).",
  inputSchema: GetLogsInputSchema, // Use the Zod schema here
  // The actual execute function is handled in src/index.ts based on the tool name
};

// Export all tools from this file
export const logTools: McpToolDefinition[] = [getLogsTool];
