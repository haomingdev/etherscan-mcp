import { z } from "zod";
import { McpToolDefinition } from "./account.js"; // Re-use interface from account tools

// --- Schemas ---
/**
 * Zod schema for the input to the agent task tool.
 * Requires a single 'prompt' string.
 */
export const AgentTaskInputSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt cannot be empty.")
    .max(2000, "Prompt exceeds maximum length of 2000 characters."), // Added max length
});

// --- Tool Definition Object ---
/**
 * MCP Tool Definition: Run an agentic task based on a natural language prompt.
 * The agent will plan and execute necessary Etherscan API calls internally.
 */
export const etherscan_runAgentTask_Def: McpToolDefinition = {
  name: "etherscan_runAgentTask",
  description:
    "Processes a natural language prompt to perform complex Etherscan queries by planning and executing multiple API calls internally using an LLM.",
  inputSchema: AgentTaskInputSchema,
};

// --- Export Array ---
// Array containing all tool definitions for this module (just one for now)
export const agentToolDefinitions: McpToolDefinition[] = [
  etherscan_runAgentTask_Def,
];
