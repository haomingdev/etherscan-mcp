import { EtherscanClient, EtherscanError } from "../utils/client.js";
import { GenerativeModel } from "@google/generative-ai";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ethers } from "ethers"; // Added for ENS resolution

// Define interfaces for the expected Plan structure from the LLM
interface PlanStep {
  toolName: string; // Should map to an EtherscanClient method name
  // Parameters should align with the EtherscanClient method's arguments
  parameters: Record<string, any>;
}

interface AgentPlan {
  reasoning?: string; // Optional explanation from LLM
  steps: PlanStep[];
}

/**
 * Orchestrates planning, execution, and synthesis for a user prompt.
 *
 * @param prompt The natural language query from the user.
 * @param etherscanClient An initialized EtherscanClient instance.
 * @param geminiModel An initialized Google Generative AI Model instance.
 * @returns A promise resolving to the synthesized string answer.
 * @throws {McpError} If a non-recoverable error occurs (e.g., LLM auth, fatal planning error).
 */
export async function runAgentTask(
  prompt: string,
  etherscanClient: EtherscanClient,
  geminiModel: GenerativeModel
): Promise<string> {
  console.error(`[Agent] Received prompt: "${prompt}"`);

  let plan: AgentPlan | null = null;
  const executionResults: { step: number; result?: any; error?: string }[] = [];

  try {
    // --- 1. Planning Step (Step 11.3) ---
    console.error("[Agent] Starting Planning Step...");
    const planningPrompt = buildPlanningPrompt(prompt, etherscanClient);
    console.error("[Agent] Planning prompt constructed. Calling Gemini...");

    let planningResponseText: string;
    try {
      const planningResult = await geminiModel.generateContent(planningPrompt);
      planningResponseText = planningResult.response.text();
      console.error(
        "[Agent] Received planning response text (raw):",
        planningResponseText
      );
    } catch (llmError: any) {
      console.error("[Agent] Error during planning LLM call:", llmError);
      throw new McpError(
        ErrorCode.InternalError,
        `Agent planning failed: LLM API error - ${
          llmError.message || "Unknown LLM error"
        }`
      );
    }

    try {
      plan = parseAndValidatePlan(planningResponseText);
      console.error(
        "[Agent] Plan parsed successfully:",
        JSON.stringify(plan, null, 2)
      );
    } catch (parseError: any) {
      console.error("[Agent] Error parsing LLM plan:", parseError);
      // Attempt synthesis with the error message
      executionResults.push({
        step: 0,
        error: `Failed to generate a valid execution plan from the LLM. Error: ${parseError.message}`,
      });
      plan = { steps: [] }; // Ensure plan is not null
    }

    // --- 2. Execution Step (Step 11.4) ---
    console.error("[Agent] Starting Execution Step...");
    if (!plan || plan.steps.length === 0) {
      // If planning failed to produce steps, this was already logged or handled in parseAndValidatePlan catch block.
      // If the plan was valid but empty, log that.
      if (plan && plan.steps.length === 0 && executionResults.length === 0) {
        console.error("[Agent] LLM generated a plan with no steps.");
        executionResults.push({
          step: 0,
          error:
            "Agent determined no actions were needed or possible based on the prompt.",
        });
      }
    } else {
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        console.error(
          `[Agent] Executing Step ${i + 1}: ${step.toolName} with params:`,
          JSON.stringify(step.parameters, null, 2) // Log params clearly
        );

        let stepResult: any = null;
        // Explicitly define as string | undefined
        let stepError: string | undefined = undefined;
        let currentParams = { ...step.parameters }; // Clone params for potential modification

        try {
          // --- ENS Resolution ---
          const toolsNeedingAddressResolution = [
            "getBalance",
            "getNormalTransactions",
            "getInternalTransactions", // If using address param
            "getTokenTransfers", // If using address param
            "getMinedBlocks",
            "getSourceCode",
            "getAbi",
            "getLogs", // If using address param
            // Add other tools that might take an address or ENS name
          ];

          if (
            toolsNeedingAddressResolution.includes(step.toolName) &&
            currentParams.address &&
            typeof currentParams.address === "string" &&
            currentParams.address.endsWith(".eth")
          ) {
            console.error(
              `[Agent] Step ${i + 1}: Attempting to resolve ENS name: ${
                currentParams.address
              }`
            );
            const resolvedAddress = await resolveEnsName(currentParams.address);
            if (resolvedAddress) {
              console.error(
                `[Agent] Step ${i + 1}: Resolved ${
                  currentParams.address
                } to ${resolvedAddress}`
              );
              currentParams.address = resolvedAddress; // Update params for the call
            } else {
              // Assign string or undefined
              stepError = `Failed to resolve ENS name: ${currentParams.address}`;
              console.error(`[Agent] Step ${i + 1}: ${stepError}`);
              // Skip execution for this step if ENS resolution fails
              executionResults.push({ step: i + 1, error: stepError }); // No ?? needed now
              continue; // Move to the next step
            }
          }
          // Also resolve 'addresses' array for getMultiBalance
          if (
            step.toolName === "getMultiBalance" &&
            currentParams.addresses &&
            Array.isArray(currentParams.addresses)
          ) {
            const resolvedAddresses: string[] = [];
            let resolutionFailed = false;
            for (const addr of currentParams.addresses) {
              if (typeof addr === "string" && addr.endsWith(".eth")) {
                console.error(
                  `[Agent] Step ${
                    i + 1
                  }: Attempting to resolve ENS name in multi-balance: ${addr}`
                );
                const resolved = await resolveEnsName(addr);
                if (resolved) {
                  console.error(
                    `[Agent] Step ${i + 1}: Resolved ${addr} to ${resolved}`
                  );
                  resolvedAddresses.push(resolved);
                } else {
                  // Assign string or undefined
                  stepError = `Failed to resolve ENS name in multi-balance list: ${addr}`;
                  console.error(`[Agent] Step ${i + 1}: ${stepError}`);
                  resolutionFailed = true;
                  break; // Stop processing this step on first failure
                }
              } else {
                // Basic validation for non-ENS addresses in the list
                if (
                  typeof addr === "string" &&
                  addr.startsWith("0x") &&
                  addr.length === 42
                ) {
                  resolvedAddresses.push(addr);
                } else {
                  // Assign string or undefined
                  stepError = `Invalid address format found in multi-balance list: ${addr}`;
                  console.error(`[Agent] Step ${i + 1}: ${stepError}`);
                  resolutionFailed = true;
                  break;
                }
              }
            }
            if (resolutionFailed) {
              executionResults.push({ step: i + 1, error: stepError });
              continue; // Move to the next step
            }
            currentParams.addresses = resolvedAddresses; // Update params for the call
          }
          // --- End ENS Resolution ---

          // Map step.toolName to actual EtherscanClient methods securely
          // Use currentParams which may have resolved addresses
          switch (step.toolName) {
            case "getBalance":
              stepResult = await etherscanClient.getBalance(
                currentParams as any
              );
              break;
            case "getMultiBalance":
              // Resolution handled above, use currentParams
              stepResult = await etherscanClient.getMultiBalance(
                currentParams.addresses,
                currentParams.chainId
              );
              break;
            case "getNormalTransactions":
              stepResult = await etherscanClient.getNormalTransactions(
                currentParams as any
              );
              break;
            case "getInternalTransactions":
              stepResult = await etherscanClient.getInternalTransactions(
                currentParams as any
              );
              break;
            case "getTokenTransfers":
              stepResult = await etherscanClient.getTokenTransfers(
                currentParams as any
              );
              break;
            case "getMinedBlocks":
              stepResult = await etherscanClient.getMinedBlocks(
                currentParams as any
              );
              break;
            case "getSourceCode":
              stepResult = await etherscanClient.getSourceCode(
                currentParams as any
              );
              break;
            case "getAbi":
              // Revert to simple assignment, let catch handle errors
              stepResult = await etherscanClient.getAbi(currentParams as any);
              break;
            case "getTokenSupply":
              stepResult = await etherscanClient.getTokenSupply(
                currentParams as any // contractaddress doesn't need resolution
              );
              break;
            case "getTokenInfo":
              stepResult = await etherscanClient.getTokenInfo(
                currentParams as any // contractaddress doesn't need resolution
              );
              break;
            case "getTransactionReceiptStatus":
              stepResult = await etherscanClient.getTransactionReceiptStatus(
                currentParams as any // txhash doesn't need resolution
              );
              break;
            case "getTransactionStatus":
              stepResult = await etherscanClient.getTransactionStatus(
                currentParams as any // txhash doesn't need resolution
              );
              break;
            case "getLogs":
              stepResult = await etherscanClient.getLogs(
                currentParams as any // address resolution handled above
              );
              break;
            // Add Geth/Proxy cases if needed by agent in future
            // case "eth_blockNumber": ...
            default:
              // Log and record error for unsupported tool
              // Assign string or undefined
              stepError = `Unsupported tool planned by LLM: ${step.toolName}`;
              console.error(`[Agent] ${stepError}`);
              break; // Skip execution if tool is not supported/mapped
          }

          if (!stepError) {
            console.error(
              `[Agent] Step ${i + 1} (${step.toolName}) executed successfully.`
            );
            executionResults.push({ step: i + 1, result: stepResult });
          } else {
            // Error already logged, just record it
            executionResults.push({ step: i + 1, error: stepError }); // No ?? needed
          }
        } catch (error: any) {
          console.error(
            `[Agent] Error executing Step ${i + 1} (${step.toolName}):`,
            error
          );
          // Determine the error message string, defaulting if necessary
          let errorMessage: string;
          if (error instanceof EtherscanError) {
            errorMessage = `Etherscan API Error: ${
              error.message ?? "Unknown Etherscan error"
            }`;
          } else if (error instanceof Error) {
            errorMessage = error.message ?? "Unknown execution error";
          } else {
            errorMessage = "Unknown execution error";
          }
          stepError = errorMessage; // Assign the guaranteed string

          // Push error (now guaranteed string | undefined)
          executionResults.push({ step: i + 1, error: stepError });
          // Continue to next step even if one fails, synthesis will report errors
        }
      }
    }
    console.error(
      "[Agent] Execution finished. Results:",
      JSON.stringify(executionResults, null, 2)
    ); // Log final results

    // --- 3. Synthesis Step (Step 11.5 & 11.6) ---
    console.error("[Agent] Starting Synthesis Step...");
    const synthesisPrompt = buildSynthesisPrompt(prompt, executionResults);
    console.error("[Agent] Synthesis prompt constructed. Calling Gemini...");

    let finalAnswer: string;
    try {
      const synthesisResult = await geminiModel.generateContent(
        synthesisPrompt
      );
      finalAnswer = synthesisResult.response.text();
      console.error("[Agent] Received final synthesized answer:", finalAnswer);
    } catch (llmError: any) {
      console.error("[Agent] Error during synthesis LLM call:", llmError);
      // Fallback answer if synthesis fails
      finalAnswer = `Agent gathered information but failed during final synthesis: ${
        llmError.message || "Unknown LLM error"
      }. Raw results: ${JSON.stringify(executionResults)}`;
    }

    return finalAnswer; // Return the final answer (Step 11.6)
  } catch (error: any) {
    // Catch errors not handled within steps (e.g., initial LLM planning call failure)
    console.error("[Agent] Unrecoverable error during agent task:", error);
    // Throw an MCPError that the main handler can catch and return to the client
    throw new McpError(
      ErrorCode.InternalError, // Or a more specific code if applicable
      `Agent failed: ${error.message || "Unknown agent error"}`
    );
  }
}

// --- Helper Functions ---

/**
 * Resolves an ENS name to an Ethereum address.
 * Uses the default provider (usually Infura or Etherscan).
 * @param name The ENS name (e.g., "vitalik.eth").
 * @returns A promise resolving to the address string or null if resolution fails.
 */
async function resolveEnsName(name: string): Promise<string | null> {
  try {
    // Use the default provider which automatically connects to common networks
    const provider = ethers.getDefaultProvider("mainnet"); // Specify mainnet for ENS
    const address = await provider.resolveName(name);
    return address;
  } catch (error: any) {
    console.error(
      `[Agent:ENS] Error resolving ENS name ${name}:`,
      error.message
    );
    return null; // Return null on error
  }
}

function buildPlanningPrompt(
  userPrompt: string,
  client: EtherscanClient
): string {
  // TODO: Construct a detailed prompt including:
  // - Role definition (You are an expert Ethereum assistant...)
  // - User's query
  // - List of available tools (EtherscanClient methods) with descriptions/schemas
  // - Instructions to output a JSON plan in the defined AgentPlan format
  console.error("[Agent:Helper] Building planning prompt..."); // Placeholder log
  // Example structure (needs refinement):
  const availableTools = [
    {
      name: "getBalance",
      description: "Get ETH balance for a single address.",
      params: "{ address: string, chainId: number }",
    },
    {
      name: "getMultiBalance",
      description: "Get ETH balance for multiple addresses.",
      params: "{ addresses: string[], chainId: number }", // Assuming addresses is an array
    },
    {
      name: "getNormalTransactions",
      description: "Get normal (external) transactions for an address.",
      params:
        "{ address: string, chainId: number, startblock?: number, endblock?: number, page?: number, offset?: number, sort?: 'asc' | 'desc' }",
    },
    {
      name: "getInternalTransactions",
      description:
        "Get internal transactions for an address or by transaction hash.",
      params:
        "{ address?: string, txhash?: string, chainId: number, startblock?: number, endblock?: number, page?: number, offset?: number, sort?: 'asc' | 'desc' }", // Added txhash option
    },
    {
      name: "getTokenTransfers",
      description:
        "Get ERC20/ERC721/ERC1155 token transfers for an address or contract.",
      params:
        "{ address?: string, contractaddress?: string, chainId: number, startblock?: number, endblock?: number, page?: number, offset?: number, sort?: 'asc' | 'desc' }",
    },
    {
      name: "getMinedBlocks",
      description: "Get blocks validated by an address.",
      params:
        "{ address: string, chainId: number, blocktype?: 'blocks' | 'uncles', page?: number, offset?: number }",
    },
    {
      name: "getSourceCode",
      description: "Get source code and ABI for a verified contract.",
      params: "{ address: string, chainId: number }",
    },
    {
      name: "getAbi",
      description: "Get ABI for a verified contract.",
      params: "{ address: string, chainId: number }",
    },
    {
      name: "getTokenSupply",
      description: "Get total supply of an ERC20 token.",
      params: "{ contractaddress: string, chainId: number }",
    },
    {
      name: "getTokenInfo",
      description: "Get information about an ERC20/ERC721 token.",
      params: "{ contractaddress: string, chainId: number }",
    },
    {
      name: "getTransactionReceiptStatus",
      description: "Check transaction receipt status (success/fail).",
      params: "{ txhash: string, chainId: number }",
    },
    {
      name: "getTransactionStatus",
      description: "Check transaction execution status (success/error).",
      params: "{ txhash: string, chainId: number }",
    },
    {
      name: "getLogs",
      description: "Get event logs.",
      params:
        "{ address?: string, fromBlock?: number | 'latest', toBlock?: number | 'latest', topic0?: string, topic1?: string, topic2?: string, topic3?: string, topic0_1_opr?: 'and' | 'or', ..., chainId: number, page?: number, offset?: number }", // Added more topic options
    },
    // Add Geth/Proxy methods if they should be callable by the agent
    // { name: "eth_blockNumber", description: "Get latest block number.", params: "{ chainId: number }" },
    // { name: "eth_getBlockByNumber", description: "Get block details by number.", params: "{ tag: string | number, boolean: boolean, chainId: number }" },
    // ... etc for other relevant client methods
  ];
  return `You are an expert Ethereum assistant using the Etherscan API. Your goal is to answer the user's query by planning and executing calls to the available Etherscan tools.

User Query: "${userPrompt}"

Available Tools:
${JSON.stringify(availableTools, null, 2)}

Based ONLY on the user query and the available tools, generate a JSON plan containing a 'steps' array. Each step must specify a 'toolName' from the list above and the necessary 'parameters' derived strictly from the user query. If the query doesn't provide enough information for a required parameter (like 'address' or 'chainId'), you MUST indicate this limitation in the reasoning and produce an empty steps array. Do not make assumptions about missing parameters. If the query involves multiple chains, create separate steps for each chain if necessary.

Output ONLY the JSON plan in the following format:
${JSON.stringify(
  {
    reasoning: "(Explain your plan or state why you cannot make one)",
    steps: [
      {
        toolName: "example_tool",
        parameters: {
          /* derived parameters */
        },
      },
    ],
  },
  null,
  2
)}
`;
}

function parseAndValidatePlan(responseText: string): AgentPlan {
  console.error("[Agent:Helper] Parsing and validating plan...");
  try {
    // Attempt to extract JSON block if markdown is present
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonToParse = jsonMatch ? jsonMatch[1] : responseText;

    const potentialPlan = JSON.parse(jsonToParse.trim());

    // Basic validation
    if (
      !potentialPlan ||
      typeof potentialPlan !== "object" ||
      !Array.isArray(potentialPlan.steps)
    ) {
      throw new Error(
        "Invalid plan structure: Missing or invalid 'steps' array."
      );
    }

    // Validate each step (basic)
    for (const step of potentialPlan.steps) {
      if (
        !step ||
        typeof step !== "object" ||
        typeof step.toolName !== "string" ||
        !step.toolName ||
        typeof step.parameters !== "object" ||
        step.parameters === null
      ) {
        throw new Error(
          `Invalid step structure: Each step must have a non-empty 'toolName' string and a 'parameters' object. Found: ${JSON.stringify(
            step
          )}`
        );
      }
      // TODO: Could add validation against known tool names here if desired
    }

    console.error("[Agent:Helper] Plan parsed and validated successfully.");
    return potentialPlan as AgentPlan;
  } catch (e: any) {
    console.error("[Agent:Helper] Failed to parse or validate plan:", e);
    throw new Error(`LLM generated invalid or unparsable plan: ${e.message}`);
  }
}

function buildSynthesisPrompt(
  originalPrompt: string,
  results: Array<{ step: number; result?: any; error?: string }>
): string {
  console.error("[Agent:Helper] Building synthesis prompt...");
  // Format results for clarity
  const formattedResults = results
    .map((r) => {
      let output = `Step ${r.step}: `;
      if (r.error) {
        output += `Error - ${r.error}`;
      } else if (r.result !== undefined) {
        // Try to stringify JSON results nicely, otherwise use raw result
        try {
          output += `Success - Data: ${JSON.stringify(r.result, null, 2)}`;
        } catch {
          output += `Success - Data: ${r.result}`;
        }
      } else {
        output += `No result or error recorded.`; // Should not happen ideally
      }
      // Truncate very long results to avoid excessive prompt length
      if (output.length > 1000) {
        output = output.substring(0, 1000) + "... (result truncated)";
      }
      return output;
    })
    .join("\n\n");

  return `You are an expert Ethereum assistant. Your task is to synthesize a final answer based on the user's original query and the results obtained from executing Etherscan API calls.

Original User Query: "${originalPrompt}"

Execution Results:
---
${formattedResults || "No execution steps were performed or results recorded."}
---

Based *only* on the original query and the provided execution results (including any errors), generate a comprehensive and user-friendly answer. Directly address the user's query. If errors occurred during execution, briefly mention them as limitations in the data gathering process. Do not make up information not present in the results. Be concise and clear.`;
}
