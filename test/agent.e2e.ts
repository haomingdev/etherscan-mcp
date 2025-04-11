import { Client } from "@modelcontextprotocol/sdk/client/index.js"; // Corrected import
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import assert from "assert"; // Added assert import
// Removed spawn import as transport will handle it
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Correct the path to point to the project root .env file
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const SERVER_COMMAND = "node";
// Correct the path to the compiled server index file
const SERVER_ARGS = [path.resolve(__dirname, "../index.js")];

// Helper function to run a tool and handle errors
async function runTool(
  client: Client, // Corrected type
  toolName: string,
  args: any
): Promise<any> {
  console.log(`\n--- Testing ${toolName} ---`);
  console.log("Arguments:", args);
  try {
    const result = await client.callTool({ name: toolName, arguments: args });
    console.log("Result:", JSON.stringify(result, null, 2)); // Log the full result structure
    if (result.isError) {
      // Ensure content is an array before accessing
      const errorText =
        Array.isArray(result.content) && result.content[0]?.type === "text"
          ? result.content[0].text
          : "Unknown error content";
      console.error("Tool returned an error:", errorText);
      throw new Error(`Tool ${toolName} failed: ${errorText}`);
    }
    // Ensure content is an array and find the text element
    let textResult: string | undefined;
    if (Array.isArray(result.content)) {
      textResult = result.content.find((c) => c.type === "text")?.text;
    }

    if (typeof textResult !== "string") {
      // Return the full result object if no text found, maybe useful for other assertions
      return result;
    }
    return textResult; // Return the text result for assertion
  } catch (error: any) {
    console.error(`Error calling ${toolName}:`, error);
    if (error instanceof McpError) {
      throw new Error(
        `MCP Error (${error.code} - ${ErrorCode[error.code]}): ${error.message}`
      );
    }
    throw error; // Re-throw other errors
  }
}

// Main test function
async function runAgentTests() {
  let client: Client | null = null; // Corrected type
  // Removed serverProcess as transport will handle it

  try {
    // Check for Google API Key
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error(
        "GOOGLE_API_KEY environment variable is not set. Skipping agent tests."
      );
    }
    if (!process.env.ETHERSCAN_API_KEY) {
      throw new Error(
        "ETHERSCAN_API_KEY environment variable is not set. Cannot run tests."
      );
    }

    // Prepare environment for the server process, merging with existing process.env
    // and ensuring required keys are present as strings.
    const serverEnv = {
      ...process.env, // Inherit existing environment (including PATH)
      ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY || "", // Ensure it's a string
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || "", // Ensure it's a string
    };
    // Add other necessary env vars if needed

    console.log("Initializing client transport...");
    // Let the transport handle spawning the server process
    const transport = new StdioClientTransport({
      command: SERVER_COMMAND,
      args: SERVER_ARGS,
      env: serverEnv, // Pass the filtered environment
    });

    // Client info (can be anything descriptive)
    const clientInfo = {
      name: "etherscan-agent-e2e-test-client",
      version: "0.1.0",
    };

    // Client options (match server name if needed, though often optional for stdio)
    const clientOptions = {
      serverName: "etherscan-mcp", // Optional: Ensure this matches server's declared name if server enforces it
      capabilities: {}, // Add empty capabilities object
    };

    client = new Client(clientInfo, clientOptions); // Corrected instantiation

    console.log("Connecting client...");
    // Pass transport to connect method
    await client.connect(transport);
    console.log("Client connected.");

    // --- Agent Test Cases ---

    // Test Case 1: Simple Balance Query
    let result1 = await runTool(client, "etherscan_runAgentTask", {
      prompt: "What is the balance of vitalik.eth on mainnet?",
    });
    assert(
      typeof result1 === "string" && result1.toLowerCase().includes("balance"),
      "Test Case 1 Failed: Response should mention balance."
    );
    console.log("Test Case 1 Assertion Passed.");

    // Test Case 2: Simple Transaction Query
    let result2 = await runTool(client, "etherscan_runAgentTask", {
      prompt:
        "Show me the latest 3 normal transactions for 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 on Ethereum mainnet.",
    });
    assert(
      typeof result2 === "string" &&
        result2.toLowerCase().includes("transaction"),
      "Test Case 2 Failed: Response should mention transactions."
    );
    console.log("Test Case 2 Assertion Passed.");

    // Test Case 3: More Complex Query (e.g., combining info)
    let result3 = await runTool(client, "etherscan_runAgentTask", {
      prompt:
        "What is the ETH balance and the total supply of the USDT token (0xdAC17F958D2ee523a2206206994597C13D831ec7) on mainnet?",
    });
    assert(
      typeof result3 === "string" &&
        result3.toLowerCase().includes("balance") &&
        result3.toLowerCase().includes("supply"),
      "Test Case 3 Failed: Response should mention balance and supply."
    );
    console.log("Test Case 3 Assertion Passed.");

    // Test Case 4: Query involving a specific chain ID (non-mainnet)
    let result4 = await runTool(client, "etherscan_runAgentTask", {
      prompt:
        "What is the balance of 0xDECAF9CD2367cdbb726E904cD6397eDFcAe6068D on Sepolia testnet?",
    });
    assert(
      typeof result4 === "string" &&
        (result4.toLowerCase().includes("balance") ||
          result4.toLowerCase().includes("sepolia")), // Check for balance or chain name
      "Test Case 4 Failed: Response should mention balance or Sepolia."
    );
    console.log("Test Case 4 Assertion Passed.");

    // Test Case 5: Potential Error Case (e.g., invalid address format in prompt)
    let result5 = await runTool(client, "etherscan_runAgentTask", {
      prompt: "What is the balance of 'invalid-address'?",
    });
    // Expecting the agent to report an issue or inability to process
    assert(
      typeof result5 === "string" &&
        (result5.toLowerCase().includes("invalid") ||
          result5.toLowerCase().includes("could not") ||
          result5.toLowerCase().includes("unable")),
      "Test Case 5 Failed: Response should indicate an issue with the invalid address."
    );
    console.log("Test Case 5 Assertion Passed.");

    // Test Case 6: Query requiring internal transactions
    let result6 = await runTool(client, "etherscan_runAgentTask", {
      prompt:
        "Find the internal transactions for address 0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549 on mainnet, limit 2",
    });
    assert(
      typeof result6 === "string" &&
        result6.toLowerCase().includes("internal transaction"),
      "Test Case 6 Failed: Response should mention internal transactions."
    );
    console.log("Test Case 6 Assertion Passed.");

    // Add more test cases as needed...

    console.log("\n✅ Agent tests completed successfully.");
  } catch (error: any) {
    console.error("\n❌ Agent test suite failed:", error.message);
    process.exitCode = 1; // Indicate failure
  } finally {
    console.log("Cleaning up...");
    if (client) {
      await client.close();
      console.log("Client closed.");
    }
    // Transport handles server process termination on client.close()
  }
}

runAgentTests();
