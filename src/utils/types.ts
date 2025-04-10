// Basic interface for common Etherscan API response structure
export interface EtherscanBaseResponse {
  status: "1" | "0"; // '1' for success, '0' for error
  message: string;
  result: any; // The actual result varies greatly between endpoints
}

// --- Account Module Types ---

/**
 * Response for 'account' module, 'balance' action.
 */
export interface EtherscanBalanceResponse extends EtherscanBaseResponse {
  result: string; // Balance in wei
}

/**
 * Structure of a single 'normal' transaction object.
 * Based on https://docs.etherscan.io/api-endpoints/accounts#get-a-list-of-normal-transactions-by-address
 */
export interface EtherscanNormalTransaction {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  transactionIndex: string;
  from: string;
  to: string;
  value: string; // In wei
  gas: string;
  gasPrice: string;
  isError: "0" | "1";
  txreceipt_status: "" | "0" | "1"; // Can be empty for pre-Byzantium blocks
  input: string;
  contractAddress: string;
  cumulativeGasUsed: string;
  gasUsed: string;
  confirmations: string;
  methodId?: string; // Optional, added by Etherscan if available
  functionName?: string; // Optional, added by Etherscan if available
}

/**
 * Response for 'account' module, 'txlist' action (normal transactions).
 */
export interface EtherscanTxListResponse extends EtherscanBaseResponse {
  result: EtherscanNormalTransaction[];
}

/**
 * Structure of a single internal transaction object.
 * Based on https://docs.etherscan.io/api-endpoints/accounts#get-a-list-of-internal-transactions-by-address
 * and https://docs.etherscan.io/api-endpoints/accounts#get-internal-transactions-by-transaction-hash-txlisthash
 */
export interface EtherscanInternalTransaction {
  blockNumber: string;
  timeStamp: string;
  hash: string; // Parent transaction hash
  from: string;
  to: string;
  value: string; // In wei
  contractAddress: string;
  input: string;
  type: string; // e.g., "call", "create"
  gas: string;
  gasUsed: string;
  traceId: string; // Identifier for the specific internal transaction
  isError: "0" | "1";
  errCode: string;
}

/**
 * Response for 'account' module, 'txlistinternal' action.
 */
export interface EtherscanInternalTxListResponse extends EtherscanBaseResponse {
  result: EtherscanInternalTransaction[];
}

/**
 * Structure of a single token transfer event (ERC20, ERC721, ERC1155).
 * Based on https://docs.etherscan.io/api-endpoints/accounts#get-a-list-of-erc20-token-transfer-events-by-address
 * Note: ERC721/1155 might have slightly different fields or interpretations (e.g., 'value' for ERC721 is tokenId).
 */
export interface EtherscanTokenTransfer {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  from: string;
  contractAddress: string;
  to: string;
  value: string; // For ERC20, amount (needs decimals). For ERC721, tokenId. For ERC1155, amount.
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string; // Decimals for ERC20/ERC1155 amount
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  input: string; // Often 'deprecated' or related to the transfer function
  confirmations: string;
  // ERC1155 specific fields might appear here if using that endpoint variant
  tokenID?: string; // Explicit for ERC721/ERC1155 transfers
  tokenValue?: string; // Explicit amount for ERC1155 transfers
}

/**
 * Response for 'account' module, 'tokentx', 'tokennfttx', 'token1155tx' actions.
 */
export interface EtherscanTokenTxResponse extends EtherscanBaseResponse {
  result: EtherscanTokenTransfer[];
}

/**
 * Structure of a block mined by an address.
 * Based on https://docs.etherscan.io/api-endpoints/accounts#get-list-of-blocks-validated-by-address
 */
export interface EtherscanMinedBlock {
  blockNumber: string;
  timeStamp: string;
  blockReward: string; // In wei
}

/**
 * Response for 'account' module, 'getminedblocks' action.
 */
export interface EtherscanMinedBlocksResponse extends EtherscanBaseResponse {
  result: EtherscanMinedBlock[];
}

// --- Contract Module Types ---

/**
 * Structure for the result item within the GetSourceCodeResponse.
 * Based on https://docs.etherscan.io/api-endpoints/contracts#get-contract-source-code-for-verified-contract-source-codes
 */
export interface EtherscanSourceCodeInfo {
  SourceCode: string; // Can be a JSON object string if multiple sources/interfaces
  ABI: string; // String representation of the contract ABI, often "Contract source code not verified"
  ContractName: string;
  CompilerVersion: string;
  OptimizationUsed: "0" | "1";
  Runs: string; // Number of optimization runs
  ConstructorArguments: string; // ABI-encoded constructor arguments
  EVMVersion: string;
  Library: string; // String representation of libraries used, or empty string
  LicenseType: string;
  Proxy: "0" | "1"; // "1" if contract is a proxy
  Implementation: string; // Address of implementation contract if Proxy is "1"
  SwarmSource: string; // Deprecated field
}

/**
 * Response for 'contract' module, 'getsourcecode' action.
 * Note: The 'result' is an array containing a single object.
 */
export interface EtherscanGetSourceCodeResponse extends EtherscanBaseResponse {
  result: EtherscanSourceCodeInfo[];
}

/**
 * Response for 'contract' module, 'getabi' action.
 * The result is simply the ABI string or an error message.
 */
export interface EtherscanGetAbiResponse extends EtherscanBaseResponse {
  result: string; // ABI JSON string or "Contract source code not verified"
}

// --- Token Module Types ---

/**
 * Response for 'stats' module, 'tokensupply' action (Note: Etherscan docs place this under Stats, but conceptually fits Tokens).
 * Based on https://docs.etherscan.io/api-endpoints/tokens#get-token-total-supply-by-contractaddress
 */
export interface EtherscanTokenSupplyResponse extends EtherscanBaseResponse {
  result: string; // Total supply as a string (needs to be divided by token decimals)
}

/**
 * Response for 'token' module, 'tokeninfo' action.
 * Based on https://docs.etherscan.io/api-endpoints/tokens#get-token-info-by-contractaddress
 */
export interface EtherscanTokenInfo {
  contractAddress: string;
  tokenName: string;
  symbol: string;
  divisor: string; // Corresponds to decimals
  tokenType: string; // e.g., "ERC-20"
  totalSupply: string; // Total supply (needs to be divided by divisor/decimals)
  blueCheckmark: string; // "Yes" or "No"
  description: string;
  website: string;
  email: string;
  blog: string;
  reddit: string;
  slack: string;
  facebook: string;
  twitter: string;
  bitcointalk: string;
  github: string;
  telegram: string;
  wechat: string;
  linkedin: string;
  discord: string;
  whitepaper: string;
  tokenPriceUSD: string;
}

/**
 * Response for 'token' module, 'tokeninfo' action.
 * Note: The 'result' is an array containing a single object.
 */
export interface EtherscanTokenInfoResponse extends EtherscanBaseResponse {
  result: EtherscanTokenInfo[];
}

// --- Transaction Module Types ---

/**
 * Response for 'transaction' module, 'gettxreceiptstatus' action.
 * Based on https://docs.etherscan.io/api-endpoints/stats-1#get-transaction-receipt-status
 * Note: Etherscan docs place this under Transactions, not Stats as the URL might imply.
 */
export interface TxReceiptStatusResponse extends EtherscanBaseResponse {
  result: {
    status: "0" | "1"; // "1" for success, "0" for failure/error
  };
}

/**
 * Response for 'transaction' module, 'getstatus' action (execution status).
 * Based on https://docs.etherscan.io/api-endpoints/stats-1#check-transaction-receipt-status
 * Note: Etherscan docs place this under Transactions, not Stats as the URL might imply.
 */
export interface TxExecutionStatusResponse extends EtherscanBaseResponse {
  result: {
    isError: "0" | "1"; // "0" for no error, "1" for error
    errDescription: string; // Description if isError is "1"
  };
}

// We will add more specific response types here later for other modules (Logs, etc.)
