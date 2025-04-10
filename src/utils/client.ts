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
          // Throw an EtherscanError instead of returning an error structure
          throw new EtherscanError(
            `Etherscan Proxy Error: ${errorMessage} (Details: ${JSON.stringify(
              rawData.error
            )})`
          );
        }
        // Handle unexpected proxy response format
        else {
          const errorMessage =
            "Proxy request failed or returned unexpected format";
          console.error(
            `[EtherscanClient:_request] Proxy request error: ${errorMessage}`,
            rawData
          );
          // Throw an EtherscanError
          throw new EtherscanError(
            `${errorMessage} (Response: ${JSON.stringify(rawData)})`
          );
        }
      } else {
        // Standard Etherscan module response handling
        if (rawData.status === "0") {
          const errorMessage = `Etherscan API Error: ${
            rawData.message || "Unknown error"
          }`;
          const errorDetails = rawData.result
            ? ` (Result: ${JSON.stringify(rawData.result)})`
            : "";
          console.warn(
            `[EtherscanClient:_request] ${errorMessage}${errorDetails}`
          );
          // Throw an EtherscanError containing the API's message and result
          throw new EtherscanError(`${errorMessage}${errorDetails}`);
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
        const status = error.response?.status;
        const data = error.response?.data;
        const message = error.message;
        console.error(
          `[EtherscanClient:_request] Axios Network/Request Error: ${message} (Status: ${
            status || "N/A"
          }, Data: ${JSON.stringify(data || "N/A")})`
        );
        // Differentiate between network errors and HTTP status errors
        if (error.response) {
          // Error response received from server
          throw new EtherscanError(
            `HTTP Error ${status}: ${message} (Response: ${JSON.stringify(
              data
            )})`
          );
        } else {
          // Network error (no response received)
          throw new EtherscanError(`Network Error: ${message}`);
        }
      } else {
        console.error(
          "[EtherscanClient:_request] Non-Axios Error during request:",
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
   * Fetches the Ether balance for a single address.
   * @param params - Object containing address and chainId.
   * @param params.address - The Ethereum address to check the balance for.
   * @param params.chainId - The chain ID (e.g., 1 for Mainnet, 11155111 for Sepolia).
   * @returns A Promise resolving to the Etherscan API response for the balance query.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/accounts#get-ether-balance-for-a-single-address
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
   * Fetches a list of 'Normal' Transactions By Address.
   * Supports pagination, sorting, and block range filtering.
   * @param params - Object containing query parameters.
   * @param params.address - The Ethereum address to query transactions for.
   * @param params.chainId - The chain ID.
   * @param params.startblock - Optional starting block number.
   * @param params.endblock - Optional ending block number.
   * @param params.page - Optional page number for pagination.
   * @param params.offset - Optional number of transactions per page.
   * @param params.sort - Optional sort order ('asc' or 'desc').
   * @returns A Promise resolving to the Etherscan API response containing the list of normal transactions.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/accounts#get-a-list-of-normal-transactions-by-address
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
   * Fetches the Ether balance for multiple addresses in a single API call.
   * @param addresses - An array of Ethereum addresses (up to 20).
   * @param chainId - The chain ID.
   * @returns A Promise resolving to the Etherscan API response containing balances for the specified addresses.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/accounts#get-ether-balance-for-multiple-addresses-in-a-single-call
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
   * Fetches a list of internal transactions by address or transaction hash.
   * Supports pagination, sorting, and block range filtering.
   * Either `address` or `txhash` must be provided.
   * @param params - Object containing query parameters.
   * @param params.address - Optional Ethereum address to query internal transactions for.
   * @param params.txhash - Optional transaction hash to query internal transactions for.
   * @param params.chainId - The chain ID.
   * @param params.startblock - Optional starting block number.
   * @param params.endblock - Optional ending block number.
   * @param params.page - Optional page number for pagination.
   * @param params.offset - Optional number of transactions per page.
   * @param params.sort - Optional sort order ('asc' or 'desc').
   * @returns A Promise resolving to the Etherscan API response containing the list of internal transactions.
   * @throws {EtherscanError} If neither address nor txhash is provided, or if the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/accounts#get-a-list-of-internal-transactions-by-address
   * @link https://docs.etherscan.io/api-endpoints/accounts#get-internal-transactions-by-transaction-hash-txlisthash
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
   * Fetches a list of ERC20/ERC721/ERC1155 Token Transfer Events by address and/or contract address.
   * Supports pagination, sorting, and block range filtering. Defaults to ERC20-like behavior (action=tokentx).
   * Either `address` or `contractaddress` must be provided.
   * @param params - Object containing query parameters.
   * @param params.address - Optional address to check transfers for.
   * @param params.contractaddress - Optional token contract address to filter by.
   * @param params.chainId - The chain ID.
   * @param params.startblock - Optional starting block number.
   * @param params.endblock - Optional ending block number.
   * @param params.page - Optional page number for pagination.
   * @param params.offset - Optional number of transactions per page.
   * @param params.sort - Optional sort order ('asc' or 'desc').
   * @returns A Promise resolving to the Etherscan API response containing the list of token transfers.
   * @throws {EtherscanError} If neither address nor contractaddress is provided, or if the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/accounts#get-a-list-of-erc20-token-transfer-events-by-address
   * @link https://docs.etherscan.io/api-endpoints/accounts#get-a-list-of-erc721-token-transfer-events-by-address
   * @link https://docs.etherscan.io/api-endpoints/accounts#get-a-list-of-erc1155-token-transfer-events-by-address
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
   * Fetches a list of blocks validated by a specific address.
   * Supports pagination and specifying block type (blocks or uncles).
   * @param params - Object containing query parameters.
   * @param params.address - The validator address.
   * @param params.chainId - The chain ID.
   * @param params.blocktype - Optional type of blocks ('blocks' or 'uncles', defaults to 'blocks').
   * @param params.page - Optional page number for pagination.
   * @param params.offset - Optional number of blocks per page.
   * @returns A Promise resolving to the Etherscan API response containing the list of mined blocks.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/accounts#get-list-of-blocks-validated-by-address
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
   * Fetches the source code for a verified contract.
   * @param params - Object containing address and chainId.
   * @param params.address - The contract address.
   * @param params.chainId - The chain ID.
   * @returns A Promise resolving to the Etherscan API response containing the source code information.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/contracts#get-contract-source-code-for-verified-contract-source-codes
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
   * Fetches the ABI for a verified contract.
   * @param params - Object containing address and chainId.
   * @param params.address - The contract address.
   * @param params.chainId - The chain ID.
   * @returns A Promise resolving to the Etherscan API response containing the ABI string or an error message.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/contracts#get-contract-abi-for-verified-contract-source-codes
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
   * Fetches the total supply of an ERC20 token.
   * @param params - Object containing contractaddress and chainId.
   * @param params.contractaddress - The token contract address.
   * @param params.chainId - The chain ID.
   * @returns A Promise resolving to the Etherscan API response containing the total supply string.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/tokens#get-token-total-supply-by-contractaddress
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
   * Fetches information about a token by its contract address.
   * @param params - Object containing contractaddress and chainId.
   * @param params.contractaddress - The token contract address.
   * @param params.chainId - The chain ID.
   * @returns A Promise resolving to the Etherscan API response containing token information.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/tokens#get-token-info-by-contractaddress
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
   * Fetches the status code of a transaction receipt (post-Byzantium).
   * Status '1' indicates success, '0' indicates failure.
   * @param params - Object containing txhash and chainId.
   * @param params.txhash - The transaction hash.
   * @param params.chainId - The chain ID.
   * @returns A Promise resolving to the Etherscan API response containing the receipt status.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/transaction#get-transaction-receipt-status
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
   * Checks the execution status of a transaction.
   * Status '0' indicates no error, '1' indicates an error occurred.
   * @param params - Object containing txhash and chainId.
   * @param params.txhash - The transaction hash.
   * @param params.chainId - The chain ID.
   * @returns A Promise resolving to the Etherscan API response containing the execution status.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/transaction#check-contract-execution-status
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
   * Fetches event logs matching specified criteria.
   * Supports filtering by block range, address, and topics with operators.
   * @param params - Object containing query parameters for log filtering.
   * @param params.chainId - The chain ID.
   * @param params.fromBlock - Optional starting block number or 'latest'.
   * @param params.toBlock - Optional ending block number or 'latest'.
   * @param params.address - Optional contract address to filter logs by.
   * @param params.topic0 - Optional Topic 0 filter.
   * @param params.topic1 - Optional Topic 1 filter.
   * @param params.topic2 - Optional Topic 2 filter.
   * @param params.topic3 - Optional Topic 3 filter.
   * @param params.topic0_1_opr - Optional operator between topic0 and topic1 ('and'/'or').
   * @param params.topic1_2_opr - Optional operator between topic1 and topic2 ('and'/'or').
   * @param params.topic2_3_opr - Optional operator between topic2 and topic3 ('and'/'or').
   * @param params.topic0_2_opr - Optional operator between topic0 and topic2 ('and'/'or').
   * @param params.topic0_3_opr - Optional operator between topic0 and topic3 ('and'/'or').
   * @param params.topic1_3_opr - Optional operator between topic1 and topic3 ('and'/'or').
   * @param params.page - Optional page number for pagination (check Etherscan docs for behavior).
   * @param params.offset - Optional number of logs per page (check Etherscan docs for behavior).
   * @returns A Promise resolving to the Etherscan API response containing the matching event logs.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/logs
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

  /**
   * Helper for making POST requests to the Etherscan API.
   * Handles base URL selection, API key appending, and error handling.
   * Synthesizes EtherscanBaseResponse structure for proxy requests.
   * @param chainId - The chain ID to target.
   * @param payload - The full payload including module, action, and other parameters for the POST body.
   * @returns A Promise resolving to the parsed API response.
   * @throws {EtherscanError} If the chainId is unsupported, the request fails, or the API returns an error status.
   * @private
   */
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
          // Throw an EtherscanError instead of returning an error structure
          throw new EtherscanError(
            `Etherscan Proxy POST Error: ${errorMessage} (Details: ${JSON.stringify(
              rawData.error
            )})`
          );
        }
        // Handle unexpected proxy response format
        else {
          const errorMessage =
            "Proxy POST request failed or returned unexpected format";
          console.error(
            `[EtherscanClient:_postRequest] Proxy POST request error: ${errorMessage}`,
            rawData
          );
          // Throw an EtherscanError
          throw new EtherscanError(
            `${errorMessage} (Response: ${JSON.stringify(rawData)})`
          );
        }
      } else {
        // Standard Etherscan module response handling
        if (rawData.status === "0") {
          const errorMessage = `Etherscan API POST Error: ${
            rawData.message || "Unknown error"
          }`;
          const errorDetails = rawData.result
            ? ` (Result: ${JSON.stringify(rawData.result)})`
            : "";
          console.warn(
            `[EtherscanClient:_postRequest] ${errorMessage}${errorDetails}`
          );
          // Throw an EtherscanError containing the API's message and result
          throw new EtherscanError(`${errorMessage}${errorDetails}`);
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
        const status = error.response?.status;
        const data = error.response?.data;
        const message = error.message;
        console.error(
          `[EtherscanClient:_postRequest] Axios Network/Request Error: ${message} (Status: ${
            status || "N/A"
          }, Data: ${JSON.stringify(data || "N/A")})`
        );
        // Differentiate between network errors and HTTP status errors
        if (error.response) {
          // Error response received from server
          throw new EtherscanError(
            `HTTP Error ${status}: ${message} (Response: ${JSON.stringify(
              data
            )})`
          );
        } else {
          // Network error (no response received)
          throw new EtherscanError(`Network Error: ${message}`);
        }
      } else {
        console.error(
          "[EtherscanClient:_postRequest] Non-Axios Error during request:",
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
   * Returns the number of the most recent block (eth_blockNumber).
   * @param params - Object containing chainId.
   * @param params.chainId - The chain ID.
   * @returns A Promise resolving to the Etherscan API response containing the block number as a hex string.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/geth-proxy#eth_blocknumber
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
   * Returns information about a block by block number (eth_getBlockByNumber).
   * @param params - Object containing tag, boolean flag, and chainId.
   * @param params.tag - The block tag ('latest', 'pending', 'earliest', or a hex block number like '0x10d4f').
   * @param params.boolean - If true, returns full transaction objects; if false, returns only transaction hashes.
   * @param params.chainId - The chain ID.
   * @returns A Promise resolving to the Etherscan API response containing the block object or null if not found.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/geth-proxy#eth_getblockbynumber
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
   * Returns the number of transactions in a specific block (eth_getBlockTransactionCountByNumber).
   * @param params - Object containing tag and chainId.
   * @param params.tag - The block tag ('latest', 'pending', 'earliest', or a hex block number).
   * @param params.chainId - The chain ID.
   * @returns A Promise resolving to the Etherscan API response containing the transaction count as a hex string.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/geth-proxy#eth_getblocktransactioncountbynumber
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
   * Returns information about a transaction by its hash (eth_getTransactionByHash).
   * @param params - Object containing txhash and chainId.
   * @param params.txhash - The transaction hash.
   * @param params.chainId - The chain ID.
   * @returns A Promise resolving to the Etherscan API response containing the transaction object or null if not found.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/geth-proxy#eth_gettransactionbyhash
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
   * Returns information about a transaction by block number and index (eth_getTransactionByBlockNumberAndIndex).
   * @param params - Object containing tag, index, and chainId.
   * @param params.tag - The block tag ('latest', 'pending', 'earliest', or a hex block number).
   * @param params.index - The hex index of the transaction within the block (e.g., '0x0').
   * @param params.chainId - The chain ID.
   * @returns A Promise resolving to the Etherscan API response containing the transaction object or null if not found.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/geth-proxy#eth_gettransactionbyblocknumberandindex
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
   * Returns the number of transactions sent from an address (eth_getTransactionCount).
   * @param params - Object containing address, tag, and chainId.
   * @param params.address - The Ethereum address.
   * @param params.tag - The block tag ('latest', 'pending', 'earliest', or a hex block number).
   * @param params.chainId - The chain ID.
   * @returns A Promise resolving to the Etherscan API response containing the transaction count (nonce) as a hex string.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/geth-proxy#eth_gettransactioncount
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
   * Submits a pre-signed transaction for broadcast (eth_sendRawTransaction). Uses POST.
   * @param params - Object containing hex and chainId.
   * @param params.hex - The signed transaction data in HEX format (starting with 0x).
   * @param params.chainId - The chain ID.
   * @returns A Promise resolving to the Etherscan API response, typically containing the transaction hash on success.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/geth-proxy#eth_sendrawtransaction
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
   * Returns the receipt of a transaction by transaction hash (eth_getTransactionReceipt).
   * @param params - Object containing txhash and chainId.
   * @param params.txhash - The transaction hash.
   * @param params.chainId - The chain ID.
   * @returns A Promise resolving to the Etherscan API response containing the transaction receipt object or null if not found/pending.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/geth-proxy#eth_gettransactionreceipt
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
   * Executes a message call immediately without creating a transaction (eth_call).
   * Useful for reading contract data.
   * @param params - Object containing to, data, tag, and chainId.
   * @param params.to - The address the transaction is directed to.
   * @param params.data - The hash of the method signature and encoded parameters.
   * @param params.tag - The block tag ('latest', 'pending', 'earliest', or a hex block number).
   * @param params.chainId - The chain ID.
   * @returns A Promise resolving to the Etherscan API response containing the return value of the executed contract code as a hex string.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/geth-proxy#eth_call
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
   * Returns the compiled smart contract code at a given address (eth_getCode).
   * @param params - Object containing address, tag, and chainId.
   * @param params.address - The Ethereum address.
   * @param params.tag - The block tag ('latest', 'pending', 'earliest', or a hex block number).
   * @param params.chainId - The chain ID.
   * @returns A Promise resolving to the Etherscan API response containing the code as a hex string.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/geth-proxy#eth_getcode
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
   * Returns the value from a storage position at a given address (eth_getStorageAt).
   * @param params - Object containing address, position, tag, and chainId.
   * @param params.address - The Ethereum address.
   * @param params.position - The hex index of the storage position (e.g., '0x0').
   * @param params.tag - The block tag ('latest', 'pending', 'earliest', or a hex block number).
   * @param params.chainId - The chain ID.
   * @returns A Promise resolving to the Etherscan API response containing the value in storage as a hex string.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/geth-proxy#eth_getstorageat
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
   * Returns the current price per gas in wei (eth_gasPrice).
   * @param params - Object containing chainId.
   * @param params.chainId - The chain ID.
   * @returns A Promise resolving to the Etherscan API response containing the current gas price as a hex string (in wei).
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/geth-proxy#eth_gasprice
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
   * Estimates the gas necessary for a transaction without executing it (eth_estimateGas).
   * @param params - Object containing transaction parameters and chainId.
   * @param params.to - The address the transaction is directed to.
   * @param params.value - The value transferred in wei (hex string).
   * @param params.gasPrice - Optional legacy gas price in wei (hex string).
   * @param params.gas - Optional gas limit (hex string).
   * @param params.data - Optional hash of the method signature and encoded parameters.
   * @param params.chainId - The chain ID.
   * @returns A Promise resolving to the Etherscan API response containing the estimated gas amount as a hex string.
   * @throws {EtherscanError} If the API returns an error or the request fails.
   * @link https://docs.etherscan.io/api-endpoints/geth-proxy#eth_estimategas
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
