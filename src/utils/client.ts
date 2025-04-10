import axios, { AxiosInstance, AxiosError } from "axios";
import {
  EtherscanBaseResponse,
  EtherscanBalanceResponse,
  EtherscanTxListResponse,
  EtherscanInternalTxListResponse,
  EtherscanTokenTxResponse,
  EtherscanMinedBlocksResponse,
  EtherscanGetSourceCodeResponse,
  EtherscanGetAbiResponse,
  EtherscanTokenSupplyResponse,
  EtherscanTokenInfoResponse,
  TxReceiptStatusResponse, // Added for Transaction module
  TxExecutionStatusResponse, // Added for Transaction module
  EtherscanGetLogsResponse, // Added for Logs module
  // --- Geth/Proxy Types ---
  EtherscanHexStringResponse,
  EtherscanGetBlockByNumberResponse,
  EtherscanGetTransactionByHashResponse,
  EtherscanGetTransactionByBlockNumberAndIndexResponse,
  EtherscanGetTransactionReceiptResponse,
  EtherscanSendRawTransactionResponse,
  EtherscanEstimateGasResponse,
} from "./types.js";

// Optional: Define a custom error class
export class EtherscanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EtherscanError";
  }
}

// --- Interfaces ---
// Generic Etherscan API response structure
export interface EtherscanApiResponse<T> {
  status: "1" | "0"; // "1" for success, "0" for error
  message: string;
  result: T;
}

// Interface for items in the multi-balance response
export interface MultiBalanceResponseItem {
  account: string;
  balance: string; // Etherscan returns balance as a string (Wei)
}

// Specific response type for getMultiBalance
export interface MultiBalanceApiResponse
  extends EtherscanApiResponse<MultiBalanceResponseItem[]> {}

export class EtherscanClient {
  private readonly apiKey: string;
  private readonly axiosInstance: AxiosInstance;
  // Define base URLs for different networks as needed, or handle dynamically
  private readonly baseUrlMap: { [chainId: number]: string } = {
    1: "https://api.etherscan.io/api", // Ethereum Mainnet
    11155111: "https://api-sepolia.etherscan.io/api", // Sepolia Testnet
    // Add other chains supported by Etherscan here (e.g., Goerli, Polygon, BSC)
    10: "https://api-optimistic.etherscan.io/api", // Optimism
    42161: "https://api.arbiscan.io/api", // Arbitrum One
    137: "https://api.polygonscan.com/api", // Polygon PoS
    56: "https://api.bscscan.com/api", // BSC Mainnet
    80094: "https://api.berachain.com/api", // Berachain Mainnet
  };

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Etherscan API key is required.");
    }
    this.apiKey = apiKey;
    this.axiosInstance = axios.create({
      timeout: 15000, // Example timeout
    });
    console.error("[EtherscanClient] Initialized.");
  }

  private getBaseUrl(chainId: number): string {
    const url = this.baseUrlMap[chainId];
    if (!url) {
      console.error(`[EtherscanClient] Unsupported chainId: ${chainId}`);
      throw new EtherscanError(
        `Unsupported chainId: ${chainId}. Supported chainIds: ${Object.keys(
          this.baseUrlMap
        ).join(", ")}`
      );
    }
    return url;
  }

  // Helper for GET requests
  // Return type is Promise<T> which should conform to EtherscanBaseResponse structure,
  // even if synthesized for proxy requests.
  private async _request<T extends EtherscanBaseResponse>(
    chainId: number,
    queryParams: Record<string, string | number | boolean>
  ): Promise<T> {
    const baseUrl = this.getBaseUrl(chainId);
    const paramsWithKey = { ...queryParams, apikey: this.apiKey };
    const isProxyRequest = queryParams.module === "proxy"; // Check if it's a proxy request

    console.error(
      `[EtherscanClient:_request] Making GET request to ${baseUrl} for chain ${chainId} with params:`,
      Object.keys(paramsWithKey).filter((k) => k !== "apikey") // Log keys, not values (API key)
    );

    try {
      const response = await this.axiosInstance.get<T>(baseUrl, {
        params: paramsWithKey,
        headers: {
          Accept: "application/json",
        },
      });

      // Basic validation
      if (response.status !== 200) {
        console.error(
          `[EtherscanClient:_request] HTTP Error: ${response.status} ${response.statusText}`
        );
        throw new EtherscanError(
          `HTTP Error: ${response.status} ${response.statusText}`
        );
      }
      if (!response.data || typeof response.data !== "object") {
        console.error(
          "[EtherscanClient:_request] Invalid response format from Etherscan API",
          response.data
        );
        throw new EtherscanError("Invalid response format from Etherscan API");
      }

      // Type the raw response data more generically to handle different structures
      const rawData: any = response.data;

      // Handle response based on whether it's a proxy request or standard Etherscan request
      if (isProxyRequest) {
        // Check for JSON-RPC success (result field exists)
        if (rawData && rawData.result !== undefined) {
          console.error(
            `[EtherscanClient:_request] Proxy request successful. Result: ${JSON.stringify(
              rawData.result
            )}`
          );
          // Synthesize a success EtherscanBaseResponse structure
          return {
            status: "1",
            message: "OK", // Synthesized message
            result: rawData.result,
          } as T; // Cast to the expected specific EtherscanBaseResponse subtype
        }
        // Check for JSON-RPC error (error field exists)
        else if (rawData && rawData.error) {
          const errorMessage =
            rawData.error.message || "Proxy request returned a JSON-RPC error";
          console.error(
            `[EtherscanClient:_request] Proxy request JSON-RPC error: ${errorMessage}`,
            rawData.error
          );
          // Synthesize an error EtherscanBaseResponse structure
          return {
            status: "0",
            message: errorMessage,
            result: rawData.error, // Include the full error object in the result field
          } as T;
        }
        // Handle unexpected proxy response format
        else {
          const errorMessage =
            "Proxy request failed or returned unexpected format";
          console.error(
            `[EtherscanClient:_request] Proxy request error: ${errorMessage}`,
            rawData
          );
          return {
            status: "0",
            message: errorMessage,
            result: rawData || null,
          } as T;
        }
      } else {
        // Standard Etherscan module response handling (already conforms to EtherscanBaseResponse)
        if (rawData.status === "0") {
          console.warn(
            `[EtherscanClient:_request] Etherscan API returned error status: ${rawData.message}, Result: ${rawData.result}`
          );
        } else {
          console.error(
            `[EtherscanClient:_request] Request successful (status ${rawData.status})`
          );
        }
        // Cast rawData to T, assuming it matches the expected EtherscanBaseResponse subtype
        return rawData as T;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          "[EtherscanClient:_request] Axios Network/Request Error:",
          error.message,
          error.response?.status,
          error.response?.data
        );
        throw new EtherscanError(`Network or Request Error: ${error.message}`);
      } else {
        console.error(
          "[EtherscanClient:_request] Unknown Error during request:",
          error
        );
        // Re-throw preserving the original error if possible
        throw error instanceof Error
          ? error
          : new EtherscanError("Unexpected Request Error: Unknown");
      }
    }
  }

  // --- Public API Methods ---

  /**
   * Get Ether Balance for a single address.
   * Module: account, Action: balance
   */
  async getBalance(params: {
    address: string;
    chainId: number;
  }): Promise<EtherscanBalanceResponse> {
    console.error(
      `[EtherscanClient:getBalance] Fetching for address ${params.address} on chain ${params.chainId}`
    );
    return this._request<EtherscanBalanceResponse>(params.chainId, {
      module: "account",
      action: "balance",
      address: params.address,
      tag: "latest",
    });
  }

  /**
   * Get a list of 'Normal' Transactions By Address.
   * Module: account, Action: txlist
   * Supports pagination and sorting.
   */
  async getNormalTransactions(params: {
    address: string;
    chainId: number;
    startblock?: number;
    endblock?: number;
    page?: number;
    offset?: number;
    sort?: "asc" | "desc";
  }): Promise<EtherscanTxListResponse> {
    console.error(
      `[EtherscanClient:getNormalTransactions] Fetching for address ${params.address} on chain ${params.chainId}`
    );
    // Construct queryParams explicitly to ensure type safety
    const queryParams: Record<string, string | number> = {
      module: "account",
      action: "txlist",
      address: params.address,
    };

    if (params.startblock !== undefined)
      queryParams.startblock = params.startblock;
    if (params.endblock !== undefined) queryParams.endblock = params.endblock;
    if (params.page !== undefined) queryParams.page = params.page;
    if (params.offset !== undefined) queryParams.offset = params.offset;
    if (params.sort !== undefined) queryParams.sort = params.sort;

    return this._request<EtherscanTxListResponse>(params.chainId, queryParams);
  }

  /**
   * Fetches the Ether balance for multiple addresses in a single call.
   * @param addresses - An array of Ethereum addresses.
   * @param chainId - The chain ID.
   * @returns A promise that resolves with the full API response object.
   */
  async getMultiBalance(
    addresses: string[],
    chainId: number
  ): Promise<MultiBalanceApiResponse> {
    console.error(
      `[EtherscanClient:getMultiBalance] Fetching balances for ${addresses.length} addresses on chain ${chainId}`
    );
    const response = await this._request<MultiBalanceApiResponse>(chainId, {
      module: "account",
      action: "balancemulti",
      address: addresses.join(","), // Join addresses with comma for API
      tag: "latest",
    });
    console.error(
      `[EtherscanClient:getMultiBalance] Received ${response.result.length} balance results.`
    );
    return response;
  }

  /**
   * Get a list of internal transactions by address or transaction hash.
   * Module: account, Action: txlistinternal
   * Supports pagination and block range.
   */
  async getInternalTransactions(params: {
    address?: string; // Either address or txhash is required
    txhash?: string;
    chainId: number;
    startblock?: number;
    endblock?: number;
    page?: number;
    offset?: number;
    sort?: "asc" | "desc";
  }): Promise<EtherscanInternalTxListResponse> {
    if (!params.address && !params.txhash) {
      throw new EtherscanError(
        "Either address or txhash must be provided for getInternalTransactions."
      );
    }
    const action = params.txhash ? "txlistinternal" : "txlistinternal"; // Action is the same for both address and txhash lookup in v2 docs? Let's assume txlistinternal covers both for now. Revisit if needed.
    const logPrefix = params.txhash
      ? `txhash ${params.txhash}`
      : `address ${params.address}`;
    console.error(
      `[EtherscanClient:getInternalTransactions] Fetching for ${logPrefix} on chain ${params.chainId}`
    );

    const queryParams: Record<string, string | number> = {
      module: "account",
      action: action, // Use determined action
    };

    if (params.address) queryParams.address = params.address;
    if (params.txhash) queryParams.txhash = params.txhash;
    if (params.startblock !== undefined)
      queryParams.startblock = params.startblock;
    if (params.endblock !== undefined) queryParams.endblock = params.endblock;
    if (params.page !== undefined) queryParams.page = params.page;
    if (params.offset !== undefined) queryParams.offset = params.offset;
    if (params.sort !== undefined) queryParams.sort = params.sort;

    return this._request<EtherscanInternalTxListResponse>(
      params.chainId,
      queryParams
    );
  }

  /**
   * Get a list of ERC20/ERC721/ERC1155 Token Transfer Events by address.
   * Module: account, Action: tokentx / tokennfttx / token1155tx
   * Supports pagination and block range. Specify contractaddress to filter by token.
   */
  async getTokenTransfers(params: {
    address?: string; // Address to check transfers for
    contractaddress?: string; // Token contract address (optional)
    chainId: number;
    startblock?: number;
    endblock?: number;
    page?: number;
    offset?: number;
    sort?: "asc" | "desc";
    // tokenType?: 'erc20' | 'erc721' | 'erc1155'; // Optional: Could determine action based on this
  }): Promise<EtherscanTokenTxResponse> {
    if (!params.address && !params.contractaddress) {
      throw new EtherscanError(
        "Either address or contractaddress must be provided for getTokenTransfers."
      );
    }
    // Determine action based on parameters or potentially a tokenType hint
    // For simplicity, we'll default to 'tokentx' which covers ERC20.
    // Etherscan might automatically handle different types, or specific actions might be needed.
    // TODO: Refine this if specific actions ('tokennfttx', 'token1155tx') are strictly required.
    const action = "tokentx";
    const logPrefix = params.address
      ? `address ${params.address}`
      : `contract ${params.contractaddress}`;
    console.error(
      `[EtherscanClient:getTokenTransfers] Fetching ${action} for ${logPrefix} on chain ${params.chainId}`
    );

    const queryParams: Record<string, string | number> = {
      module: "account",
      action: action,
    };

    if (params.address) queryParams.address = params.address;
    if (params.contractaddress)
      queryParams.contractaddress = params.contractaddress;
    if (params.startblock !== undefined)
      queryParams.startblock = params.startblock;
    if (params.endblock !== undefined) queryParams.endblock = params.endblock;
    if (params.page !== undefined) queryParams.page = params.page;
    if (params.offset !== undefined) queryParams.offset = params.offset;
    if (params.sort !== undefined) queryParams.sort = params.sort;

    return this._request<EtherscanTokenTxResponse>(params.chainId, queryParams);
  }

  /**
   * Get list of blocks validated by address.
   * Module: account, Action: getminedblocks
   */
  async getMinedBlocks(params: {
    address: string;
    chainId: number;
    blocktype?: "blocks" | "uncles"; // Default is 'blocks'
    page?: number;
    offset?: number;
  }): Promise<EtherscanMinedBlocksResponse> {
    console.error(
      `[EtherscanClient:getMinedBlocks] Fetching for address ${params.address} on chain ${params.chainId}`
    );

    const queryParams: Record<string, string | number> = {
      module: "account",
      action: "getminedblocks",
      address: params.address,
    };

    if (params.blocktype) queryParams.blocktype = params.blocktype;
    if (params.page !== undefined) queryParams.page = params.page;
    if (params.offset !== undefined) queryParams.offset = params.offset;

    return this._request<EtherscanMinedBlocksResponse>(
      params.chainId,
      queryParams
    );
  }

  // --- Contract Module Methods ---

  /**
   * Get Contract Source Code for Verified Contract Source Codes.
   * Module: contract, Action: getsourcecode
   */
  async getSourceCode(params: {
    address: string;
    chainId: number;
  }): Promise<EtherscanGetSourceCodeResponse> {
    console.error(
      `[EtherscanClient:getSourceCode] Fetching for contract ${params.address} on chain ${params.chainId}`
    );
    return this._request<EtherscanGetSourceCodeResponse>(params.chainId, {
      module: "contract",
      action: "getsourcecode",
      address: params.address,
    });
  }

  /**
   * Get Contract ABI for Verified Contract Source Codes.
   * Module: contract, Action: getabi
   */
  async getAbi(params: {
    address: string;
    chainId: number;
  }): Promise<EtherscanGetAbiResponse> {
    console.error(
      `[EtherscanClient:getAbi] Fetching ABI for contract ${params.address} on chain ${params.chainId}`
    );
    return this._request<EtherscanGetAbiResponse>(params.chainId, {
      module: "contract",
      action: "getabi",
      address: params.address,
    });
  }

  // --- Token Module Methods ---

  /**
   * Get ERC20-Token TotalSupply by ContractAddress.
   * Module: stats, Action: tokensupply
   */
  async getTokenSupply(params: {
    contractaddress: string;
    chainId: number;
  }): Promise<EtherscanTokenSupplyResponse> {
    console.error(
      `[EtherscanClient:getTokenSupply] Fetching supply for contract ${params.contractaddress} on chain ${params.chainId}`
    );
    // Note: Etherscan docs place this under 'stats' module
    return this._request<EtherscanTokenSupplyResponse>(params.chainId, {
      module: "stats",
      action: "tokensupply",
      contractaddress: params.contractaddress,
    });
  }

  /**
   * Get Token Info by ContractAddress.
   * Module: token, Action: tokeninfo
   */
  async getTokenInfo(params: {
    contractaddress: string;
    chainId: number;
  }): Promise<EtherscanTokenInfoResponse> {
    console.error(
      `[EtherscanClient:getTokenInfo] Fetching info for contract ${params.contractaddress} on chain ${params.chainId}`
    );
    return this._request<EtherscanTokenInfoResponse>(params.chainId, {
      module: "token",
      action: "tokeninfo",
      contractaddress: params.contractaddress,
    });
  }

  // --- Transaction Module Methods ---

  /**
   * Get Transaction Receipt Status.
   * Module: transaction, Action: gettxreceiptstatus
   * Note: Only applicable for post-Byzantium fork transactions. Status '1' = Success, '0' = Failed.
   */
  async getTransactionReceiptStatus(params: {
    txhash: string;
    chainId: number;
  }): Promise<TxReceiptStatusResponse> {
    console.error(
      `[EtherscanClient:getTransactionReceiptStatus] Fetching receipt status for tx ${params.txhash} on chain ${params.chainId}`
    );
    return this._request<TxReceiptStatusResponse>(params.chainId, {
      module: "transaction",
      action: "gettxreceiptstatus",
      txhash: params.txhash,
    });
  }

  /**
   * Check Transaction Execution Status.
   * Module: transaction, Action: getstatus
   * Note: Status '0' = Pass, '1' = Error. Provides errDescription if error.
   */
  async getTransactionStatus(params: {
    txhash: string;
    chainId: number;
  }): Promise<TxExecutionStatusResponse> {
    console.error(
      `[EtherscanClient:getTransactionStatus] Fetching execution status for tx ${params.txhash} on chain ${params.chainId}`
    );
    return this._request<TxExecutionStatusResponse>(params.chainId, {
      module: "transaction",
      action: "getstatus", // Correct action for execution status
      txhash: params.txhash,
    });
  }

  // --- Logs Module Methods ---

  /**
   * Get event logs matching specified criteria.
   * Module: logs, Action: getLogs
   * Supports filtering by block range, address, and topics.
   * Note: Pagination parameters (page, offset) might have limitations or specific behavior with logs.
   */
  async getLogs(params: {
    chainId: number;
    fromBlock?: number | "latest";
    toBlock?: number | "latest";
    address?: string;
    // Topics are 32-byte hex strings (0x...)
    topic0?: string;
    topic1?: string;
    topic2?: string;
    topic3?: string;
    // Topic operators ('and'/'or')
    topic0_1_opr?: "and" | "or";
    topic1_2_opr?: "and" | "or";
    topic2_3_opr?: "and" | "or";
    topic0_2_opr?: "and" | "or";
    topic0_3_opr?: "and" | "or";
    topic1_3_opr?: "and" | "or";
    // Pagination (use with caution, check Etherscan docs for behavior)
    page?: number;
    offset?: number;
  }): Promise<EtherscanGetLogsResponse> {
    console.error(
      `[EtherscanClient:getLogs] Fetching logs for chain ${params.chainId}`
    );

    const queryParams: Record<string, string | number> = {
      module: "logs",
      action: "getLogs",
    };

    // Add optional parameters if they exist
    if (params.fromBlock !== undefined)
      queryParams.fromBlock = params.fromBlock;
    if (params.toBlock !== undefined) queryParams.toBlock = params.toBlock;
    if (params.address) queryParams.address = params.address;
    if (params.topic0) queryParams.topic0 = params.topic0;
    if (params.topic1) queryParams.topic1 = params.topic1;
    if (params.topic2) queryParams.topic2 = params.topic2;
    if (params.topic3) queryParams.topic3 = params.topic3;
    if (params.topic0_1_opr) queryParams.topic0_1_opr = params.topic0_1_opr;
    if (params.topic1_2_opr) queryParams.topic1_2_opr = params.topic1_2_opr;
    if (params.topic2_3_opr) queryParams.topic2_3_opr = params.topic2_3_opr;
    if (params.topic0_2_opr) queryParams.topic0_2_opr = params.topic0_2_opr;
    if (params.topic0_3_opr) queryParams.topic0_3_opr = params.topic0_3_opr;
    if (params.topic1_3_opr) queryParams.topic1_3_opr = params.topic1_3_opr;
    if (params.page !== undefined) queryParams.page = params.page;
    if (params.offset !== undefined) queryParams.offset = params.offset;

    return this._request<EtherscanGetLogsResponse>(params.chainId, queryParams);
  }

  // Add other methods here for other modules (Gas Tracker, Stats)

  // Helper for POST requests (needed for eth_sendRawTransaction)
  // Return type is Promise<T> which should conform to EtherscanBaseResponse structure,
  // even if synthesized for proxy requests.
  private async _postRequest<T extends EtherscanBaseResponse>(
    chainId: number,
    payload: Record<string, string | number>
  ): Promise<T> {
    const baseUrl = this.getBaseUrl(chainId);
    const isProxyRequest = payload.module === "proxy"; // Check if it's a proxy request

    // Prepare query params (always include module, action, apikey)
    const queryParams = {
      module: payload.module,
      action: payload.action,
      apikey: this.apiKey,
    };

    // Prepare POST body data (exclude module, action, apikey)
    const postData: Record<string, string | number> = {};
    for (const key in payload) {
      if (key !== "module" && key !== "action" && key !== "apikey") {
        postData[key] = payload[key];
      }
    }

    console.error(
      `[EtherscanClient:_postRequest] Making POST request to ${baseUrl} for chain ${chainId} with query:`,
      Object.keys(queryParams).filter((k) => k !== "apikey"),
      "and body keys:",
      Object.keys(postData)
    );

    try {
      // Send POST request with query parameters and data in the body
      // Etherscan POST often uses x-www-form-urlencoded, let axios handle it
      const response = await this.axiosInstance.post<T>(baseUrl, postData, {
        params: queryParams,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded", // Common for Etherscan POST
        },
      });

      // Basic validation (same as _request)
      if (response.status !== 200) {
        console.error(
          `[EtherscanClient:_postRequest] HTTP Error: ${response.status} ${response.statusText}`
        );
        throw new EtherscanError(
          `HTTP Error: ${response.status} ${response.statusText}`
        );
      }
      if (!response.data || typeof response.data !== "object") {
        console.error(
          "[EtherscanClient:_postRequest] Invalid response format from Etherscan API",
          response.data
        );
        throw new EtherscanError("Invalid response format from Etherscan API");
      }

      // Type the raw response data more generically
      const rawData: any = response.data;

      // Handle response based on whether it's a proxy request or standard Etherscan request
      if (isProxyRequest) {
        // Check for JSON-RPC success (result field exists)
        if (rawData && rawData.result !== undefined) {
          console.error(
            `[EtherscanClient:_postRequest] Proxy POST request successful. Result: ${JSON.stringify(
              rawData.result
            )}`
          );
          // Synthesize a success EtherscanBaseResponse structure
          return {
            status: "1",
            message: "OK",
            result: rawData.result,
          } as T;
        }
        // Check for JSON-RPC error (error field exists)
        else if (rawData && rawData.error) {
          const errorMessage =
            rawData.error.message ||
            "Proxy POST request returned a JSON-RPC error";
          console.error(
            `[EtherscanClient:_postRequest] Proxy POST request JSON-RPC error: ${errorMessage}`,
            rawData.error
          );
          // Synthesize an error EtherscanBaseResponse structure
          return {
            status: "0",
            message: errorMessage,
            result: rawData.error, // Include the full error object
          } as T;
        }
        // Handle unexpected proxy response format
        else {
          const errorMessage =
            "Proxy POST request failed or returned unexpected format";
          console.error(
            `[EtherscanClient:_postRequest] Proxy POST request error: ${errorMessage}`,
            rawData
          );
          return {
            status: "0",
            message: errorMessage,
            result: rawData || null,
          } as T;
        }
      } else {
        // Standard Etherscan module response handling
        if (rawData.status === "0") {
          console.warn(
            `[EtherscanClient:_postRequest] Etherscan API returned error status: ${rawData.message}, Result: ${rawData.result}`
          );
        } else {
          console.error(
            `[EtherscanClient:_postRequest] Request successful (status ${rawData.status})`
          );
        }
        // Cast rawData to T, assuming it matches the expected EtherscanBaseResponse subtype
        return rawData as T;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          "[EtherscanClient:_postRequest] Axios Network/Request Error:",
          error.message,
          error.response?.status,
          error.response?.data
        );
        throw new EtherscanError(`Network or Request Error: ${error.message}`);
      } else {
        console.error(
          "[EtherscanClient:_postRequest] Unknown Error during request:",
          error
        );
        throw error instanceof Error
          ? error
          : new EtherscanError("Unexpected Request Error: Unknown");
      }
    }
  }

  // --- Geth/Proxy Module Methods ---

  /**
   * Returns the number of most recent block.
   * Module: proxy, Action: eth_blockNumber
   */
  async eth_blockNumber(params: {
    chainId: number;
  }): Promise<EtherscanHexStringResponse> {
    console.error(
      `[EtherscanClient:eth_blockNumber] Fetching for chain ${params.chainId}`
    );
    return this._request<EtherscanHexStringResponse>(params.chainId, {
      module: "proxy",
      action: "eth_blockNumber",
    });
  }

  /**
   * Returns information about a block by block number.
   * Module: proxy, Action: eth_getBlockByNumber
   */
  async eth_getBlockByNumber(params: {
    tag: string; // Hex block number or 'latest'
    boolean: boolean; // true for full tx objects, false for hashes only
    chainId: number;
  }): Promise<EtherscanGetBlockByNumberResponse> {
    console.error(
      `[EtherscanClient:eth_getBlockByNumber] Fetching block ${params.tag} on chain ${params.chainId}`
    );
    return this._request<EtherscanGetBlockByNumberResponse>(params.chainId, {
      module: "proxy",
      action: "eth_getBlockByNumber",
      tag: params.tag,
      boolean: params.boolean,
    });
  }

  /**
   * Returns the number of transactions in a block from a block matching the given block number.
   * Module: proxy, Action: eth_getBlockTransactionCountByNumber
   */
  async eth_getBlockTransactionCountByNumber(params: {
    tag: string; // Hex block number or 'latest'
    chainId: number;
  }): Promise<EtherscanHexStringResponse> {
    console.error(
      `[EtherscanClient:eth_getBlockTransactionCountByNumber] Fetching tx count for block ${params.tag} on chain ${params.chainId}`
    );
    return this._request<EtherscanHexStringResponse>(params.chainId, {
      module: "proxy",
      action: "eth_getBlockTransactionCountByNumber",
      tag: params.tag,
    });
  }

  /**
   * Returns the information about a transaction requested by transaction hash.
   * Module: proxy, Action: eth_getTransactionByHash
   */
  async eth_getTransactionByHash(params: {
    txhash: string;
    chainId: number;
  }): Promise<EtherscanGetTransactionByHashResponse> {
    console.error(
      `[EtherscanClient:eth_getTransactionByHash] Fetching tx ${params.txhash} on chain ${params.chainId}`
    );
    return this._request<EtherscanGetTransactionByHashResponse>(
      params.chainId,
      {
        module: "proxy",
        action: "eth_getTransactionByHash",
        txhash: params.txhash,
      }
    );
  }

  /**
   * Returns information about a transaction by block number and transaction index position.
   * Module: proxy, Action: eth_getTransactionByBlockNumberAndIndex
   */
  async eth_getTransactionByBlockNumberAndIndex(params: {
    tag: string; // Hex block number or 'latest'
    index: string; // Hex transaction index
    chainId: number;
  }): Promise<EtherscanGetTransactionByBlockNumberAndIndexResponse> {
    console.error(
      `[EtherscanClient:eth_getTransactionByBlockNumberAndIndex] Fetching tx at index ${params.index} in block ${params.tag} on chain ${params.chainId}`
    );
    return this._request<EtherscanGetTransactionByBlockNumberAndIndexResponse>(
      params.chainId,
      {
        module: "proxy",
        action: "eth_getTransactionByBlockNumberAndIndex",
        tag: params.tag,
        index: params.index,
      }
    );
  }

  /**
   * Returns the number of transactions sent from an address.
   * Module: proxy, Action: eth_getTransactionCount
   */
  async eth_getTransactionCount(params: {
    address: string;
    tag: string; // 'latest', 'pending', 'earliest' or hex block number
    chainId: number;
  }): Promise<EtherscanHexStringResponse> {
    console.error(
      `[EtherscanClient:eth_getTransactionCount] Fetching tx count for address ${params.address} at tag ${params.tag} on chain ${params.chainId}`
    );
    return this._request<EtherscanHexStringResponse>(params.chainId, {
      module: "proxy",
      action: "eth_getTransactionCount",
      address: params.address,
      tag: params.tag,
    });
  }

  /**
   * Submits a pre-signed transaction for broadcast to the Ethereum network.
   * Module: proxy, Action: eth_sendRawTransaction (POST Request)
   */
  async eth_sendRawTransaction(params: {
    hex: string; // Signed transaction data in HEX format
    chainId: number;
  }): Promise<EtherscanSendRawTransactionResponse> {
    console.error(
      `[EtherscanClient:eth_sendRawTransaction] Sending raw tx on chain ${params.chainId}`
    );
    return this._postRequest<EtherscanSendRawTransactionResponse>(
      params.chainId,
      {
        module: "proxy",
        action: "eth_sendRawTransaction",
        hex: params.hex,
      }
    );
  }

  /**
   * Returns the receipt of a transaction by transaction hash.
   * Module: proxy, Action: eth_getTransactionReceipt
   */
  async eth_getTransactionReceipt(params: {
    txhash: string;
    chainId: number;
  }): Promise<EtherscanGetTransactionReceiptResponse> {
    console.error(
      `[EtherscanClient:eth_getTransactionReceipt] Fetching receipt for tx ${params.txhash} on chain ${params.chainId}`
    );
    return this._request<EtherscanGetTransactionReceiptResponse>(
      params.chainId,
      {
        module: "proxy",
        action: "eth_getTransactionReceipt",
        txhash: params.txhash,
      }
    );
  }

  /**
   * Executes a new message call immediately without creating a transaction on the block chain.
   * Module: proxy, Action: eth_call
   */
  async eth_call(params: {
    to: string; // Address to execute call against
    data: string; // Hex encoded data (e.g., function selector and arguments)
    tag: string; // 'latest', 'pending', 'earliest' or hex block number
    chainId: number;
  }): Promise<EtherscanHexStringResponse> {
    console.error(
      `[EtherscanClient:eth_call] Executing call to ${params.to} at tag ${params.tag} on chain ${params.chainId}`
    );
    return this._request<EtherscanHexStringResponse>(params.chainId, {
      module: "proxy",
      action: "eth_call",
      to: params.to,
      data: params.data,
      tag: params.tag,
    });
  }

  /**
   * Returns code at a given address.
   * Module: proxy, Action: eth_getCode
   */
  async eth_getCode(params: {
    address: string;
    tag: string; // 'latest', 'pending', 'earliest' or hex block number
    chainId: number;
  }): Promise<EtherscanHexStringResponse> {
    console.error(
      `[EtherscanClient:eth_getCode] Fetching code for address ${params.address} at tag ${params.tag} on chain ${params.chainId}`
    );
    return this._request<EtherscanHexStringResponse>(params.chainId, {
      module: "proxy",
      action: "eth_getCode",
      address: params.address,
      tag: params.tag,
    });
  }

  /**
   * Returns the value from a storage position at a given address.
   * Module: proxy, Action: eth_getStorageAt
   */
  async eth_getStorageAt(params: {
    address: string;
    position: string; // Hex storage position
    tag: string; // 'latest', 'pending', 'earliest' or hex block number
    chainId: number;
  }): Promise<EtherscanHexStringResponse> {
    console.error(
      `[EtherscanClient:eth_getStorageAt] Fetching storage at position ${params.position} for address ${params.address} at tag ${params.tag} on chain ${params.chainId}`
    );
    return this._request<EtherscanHexStringResponse>(params.chainId, {
      module: "proxy",
      action: "eth_getStorageAt",
      address: params.address,
      position: params.position,
      tag: params.tag,
    });
  }

  /**
   * Returns the current price per gas in wei.
   * Module: proxy, Action: eth_gasPrice
   */
  async eth_gasPrice(params: {
    chainId: number;
  }): Promise<EtherscanHexStringResponse> {
    console.error(
      `[EtherscanClient:eth_gasPrice] Fetching gas price for chain ${params.chainId}`
    );
    return this._request<EtherscanHexStringResponse>(params.chainId, {
      module: "proxy",
      action: "eth_gasPrice",
    });
  }

  /**
   * Makes a call or transaction, which won't be added to the blockchain and returns the used gas.
   * Module: proxy, Action: eth_estimateGas
   */
  async eth_estimateGas(params: {
    to: string;
    value: string; // Hex value in wei
    gasPrice?: string; // Hex gas price (legacy)
    gas?: string; // Hex gas limit
    data?: string; // Hex encoded data
    chainId: number;
  }): Promise<EtherscanEstimateGasResponse> {
    console.error(
      `[EtherscanClient:eth_estimateGas] Estimating gas for call to ${params.to} on chain ${params.chainId}`
    );
    const queryParams: Record<string, string | number> = {
      module: "proxy",
      action: "eth_estimateGas",
      to: params.to,
      value: params.value,
    };
    if (params.gasPrice) queryParams.gasPrice = params.gasPrice;
    if (params.gas) queryParams.gas = params.gas;
    if (params.data) queryParams.data = params.data;

    return this._request<EtherscanEstimateGasResponse>(
      params.chainId,
      queryParams
    );
  }

  // Add other methods here for other modules (Stats)
}
