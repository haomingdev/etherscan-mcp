import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
// Path to the compiled server executable
// Since this script runs from dist/test/e2e.js, the server is at dist/index.js
const serverExecutable = path.resolve(__dirname, "../index.js");
const serverName = "etherscan-mcp"; // Match the server name defined in index.ts

// --- Test Cases ---
// Define test cases as objects with tool name and arguments
const testCases = [
  // === Account Module ===
  {
    description: "Get Balance (Mainnet - Vitalik)",
    tool: "etherscan_getBalance",
    args: {
      address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      chainId: 1,
    },
  },
  {
    description: "Get Balance (Sepolia - Vitalik)",
    tool: "etherscan_getBalance",
    args: {
      address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      chainId: 11155111,
    },
  },
  {
    description: "Get Multi Balance (Mainnet)",
    tool: "etherscan_getMultiBalance",
    args: {
      addresses: [
        "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B", // Example address 2
      ],
      chainId: 1,
    },
  },
  {
    description:
      "Get Normal Transactions (Sepolia - Vitalik, Page 2, Offset 5)",
    tool: "etherscan_getNormalTransactions",
    args: {
      address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      chainId: 11155111,
      page: 2,
      offset: 5,
      sort: "desc",
    },
  },
  {
    description:
      "Get Internal Transactions by TxHash (Mainnet - Known Tornado Cash)",
    tool: "etherscan_getInternalTransactions",
    args: {
      txhash:
        "0x71d735337083af41941b88585a857b804796ea8be06790038d74f0f0f7731113",
      chainId: 1,
    },
  },
  {
    description: "Get Token Transfers (Mainnet - USDT Contract)",
    tool: "etherscan_getTokenTransfers",
    args: {
      contractaddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
      chainId: 1,
      page: 1,
      offset: 3,
    },
  },
  {
    description: "Get Mined Blocks (Mainnet - Ethermine)",
    tool: "etherscan_getMinedBlocks",
    args: {
      address: "0xEA674fdDe714fd979de3EdF0F56AA9716B898ec8", // Ethermine Pool
      chainId: 1,
      page: 1,
      offset: 2,
    },
  },

  // === Contract Module ===
  {
    description: "Get Source Code (Mainnet - USDT)",
    tool: "etherscan_getSourceCode",
    args: {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
      chainId: 1,
    },
  },
  {
    description: "Get ABI (Mainnet - USDT)",
    tool: "etherscan_getAbi",
    args: {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
      chainId: 1,
    },
  },

  // === Token Module ===
  {
    description: "Get Token Supply (Mainnet - USDT)",
    tool: "etherscan_getTokenSupply",
    args: {
      contractaddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
      chainId: 1,
    },
  },
  {
    description: "Get Token Info (Mainnet - USDT)",
    tool: "etherscan_getTokenInfo",
    args: {
      contractaddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
      chainId: 1,
    },
  },

  // === Transaction Module ===
  {
    description: "Get Tx Receipt Status (Mainnet - Success Example)",
    tool: "etherscan_getTransactionReceiptStatus",
    args: {
      txhash:
        "0x45047bbfa0cef069b18db64732d2d4b56c6cd39bc8e7fa76f84a4c7c53c752eb",
      chainId: 1,
    },
  },
  {
    description: "Get Tx Execution Status (Mainnet - Success Example)",
    tool: "etherscan_getTransactionStatus",
    args: {
      txhash:
        "0x45047bbfa0cef069b18db64732d2d4b56c6cd39bc8e7fa76f84a4c7c53c752eb",
      chainId: 1,
    },
  },

  // === Logs Module ===
  {
    description: "Get Logs (Mainnet - USDT Transfers, last 10 blocks)", // Need block numbers
    tool: "etherscan_getLogs",
    args: {
      chainId: 1,
      fromBlock: 22237894, // Replace with actual recent block numbers
      toBlock: 22237904, // Replace with actual recent block numbers
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
      topic0:
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", // Transfer Event
      offset: 2,
    },
  },

  // === Proxy Module ===
  {
    description: "Proxy: Get Latest Block Number (Mainnet)",
    tool: "etherscan_eth_blockNumber",
    args: { chainId: 1 },
  },
  {
    description: "Proxy: Get Block By Number (Mainnet - Latest, hashes only)",
    tool: "etherscan_eth_getBlockByNumber",
    args: { chainId: 1, tag: "latest", boolean: false },
  },
  {
    description: "Proxy: Get Tx By Hash (Mainnet)",
    tool: "etherscan_eth_getTransactionByHash",
    args: {
      chainId: 1,
      txhash:
        "0x45047bbfa0cef069b18db64732d2d4b56c6cd39bc8e7fa76f84a4c7c53c752eb",
    },
  },
  {
    description: "Proxy: Get Tx Receipt (Mainnet)",
    tool: "etherscan_eth_getTransactionReceipt",
    args: {
      chainId: 1,
      txhash:
        "0x45047bbfa0cef069b18db64732d2d4b56c6cd39bc8e7fa76f84a4c7c53c752eb",
    },
  },
  {
    description: "Proxy: Get Gas Price (Mainnet)",
    tool: "etherscan_eth_gasPrice",
    args: { chainId: 1 },
  },
  // Add more test cases for other tools and edge cases
];

// --- Test Runner ---
async function runTests() {
  console.log("Starting Etherscan MCP Server process...");
  const serverProcess = spawn("node", [serverExecutable], {
    stdio: ["pipe", "pipe", "pipe"], // Use pipes for stdin, stdout, stderr
  });

  // Log server stderr for debugging setup issues
  serverProcess.stderr?.on("data", (data) => {
    console.error(`[Server STDERR]: ${data.toString().trim()}`);
  });

  // Log server stdout (might contain MCP responses if not fully using stderr)
  serverProcess.stdout?.on("data", (data) => {
    console.log(`[Server STDOUT]: ${data.toString().trim()}`);
  });

  serverProcess.on("error", (err) => {
    console.error("Failed to start server process:", err);
    process.exit(1);
  });

  serverProcess.on("close", (code) => {
    console.log(`Server process exited with code ${code}`);
  });

  // Allow some time for the server to initialize
  await new Promise((resolve) => setTimeout(resolve, 3000)); // Adjust delay if needed

  console.log("Connecting MCP Client via Stdio...");
  const transport = new StdioClientTransport({
    command: "node", // Command to run the server
    args: [serverExecutable], // Arguments for the server command
  });

  // Client info (can be anything descriptive)
  const clientInfo = {
    name: "etherscan-e2e-test-client",
    version: "0.1.0",
  };

  // Client options
  const clientOptions = {
    serverName: serverName, // Ensure this matches the server's declared name
    capabilities: {}, // Add empty capabilities object
  };

  const client = new Client(clientInfo, clientOptions);

  try {
    // Pass transport to connect method
    await client.connect(transport);
    console.log("MCP Client Connected.");

    for (const testCase of testCases) {
      console.log(`\n--- Running Test: ${testCase.description} ---`);
      console.log(`Tool: ${testCase.tool}`);
      console.log(`Args: ${JSON.stringify(testCase.args)}`);
      try {
        const result = await client.callTool({
          name: testCase.tool,
          arguments: testCase.args,
        });
        console.log("Result:", JSON.stringify(result, null, 2));
        console.log(`✅ Test Passed: ${testCase.description}`);
      } catch (error: any) {
        console.error("Error:", error.message || error);
        console.error(`❌ Test Failed: ${testCase.description}`);
        // Optionally, decide if failure should stop all tests
        // break;
      }
      // Add a small delay between tests to avoid potential rate limits
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch (error: any) {
    console.error("Failed to connect or run tests:", error.message || error);
  } finally {
    console.log("\n--- Tests Complete ---");
    await client.close();
    console.log("MCP Client Disconnected.");
    // Ensure the server process is terminated
    if (!serverProcess.killed) {
      console.log("Terminating server process...");
      serverProcess.kill();
    }
  }
}

runTests();
