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
  EtherscanTokenSupplyResponse, // Added
  EtherscanTokenInfoResponse, // Added
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

  // Simplified private helper method for making requests (placeholder)
  private async _request<T extends EtherscanBaseResponse>(
    chainId: number,
    queryParams: Record<string, string | number>
  ): Promise<T> {
    const baseUrl = this.getBaseUrl(chainId);
    const paramsWithKey = { ...queryParams, apikey: this.apiKey };

    console.error(
      `[EtherscanClient:_request] Making GET request to ${baseUrl} for chain ${chainId} with params:`,
      Object.keys(paramsWithKey) // Log keys, not values (API key)
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

      // Etherscan specific status check (status '0' means API error)
      // IMPORTANT: We return the response even on error, as the message/result might be useful.
      // The tool handler should check the status field.
      if (response.data.status === "0") {
        console.warn(
          `[EtherscanClient:_request] Etherscan API returned error status: ${response.data.message}, Result: ${response.data.result}`
        );
        // Potentially throw here if we *never* want to return error responses to the handler
        // throw new EtherscanError(response.data.message || 'Etherscan API Error');
      } else {
        console.error(
          `[EtherscanClient:_request] Request successful (status ${response.data.status})`
        );
      }

      return response.data;
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

  // Add other methods here for other modules (logs, etc.)
}
