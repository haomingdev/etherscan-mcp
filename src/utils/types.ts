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

// --- Logs Module Types ---

/**
 * Structure of a single log entry returned by the 'logs' module, 'getLogs' action.
 * Based on https://docs.etherscan.io/api-endpoints/logs
 */
export interface EtherscanLogEntry {
  address: string; // Address from which this log originated
  topics: string[]; // Array of 0 to 4 32-byte data fields (indexed log arguments)
  data: string; // Contains the non-indexed arguments of the log
  blockNumber: string; // Block number where this log was in, hex string (e.g., "0x10d4f")
  timeStamp: string; // Timestamp for the block, hex string (e.g., "0x5a97f5d9")
  gasPrice: string; // Gas price for the transaction, hex string
  gasUsed: string; // Gas used by the transaction, hex string
  logIndex: string; // Log index position in the block, hex string (e.g., "0x0")
  transactionHash: string; // Hash of the transaction this log was created from
  transactionIndex: string; // Transaction index position log was created from, hex string (e.g., "0x0")
}

/**
 * Response for 'logs' module, 'getLogs' action.
 */
export interface EtherscanGetLogsResponse extends EtherscanBaseResponse {
  result: EtherscanLogEntry[];
}

// We will add more specific response types here later for other modules (Logs, etc.)

// --- Geth/Proxy Module Types ---
// Based on standard Ethereum JSON-RPC responses, wrapped in EtherscanBaseResponse

/**
 * Generic response for endpoints returning a single hex string value.
 */
export interface EtherscanHexStringResponse extends EtherscanBaseResponse {
  result: string; // Hex string value (e.g., block number, gas price, count)
}

/**
 * Structure for an Ethereum Block object (simplified).
 * Based on https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblockbynumber
 */
export interface EtherscanBlockObject {
  number: string; // Hex block number
  hash: string; // Block hash
  parentHash: string;
  nonce: string;
  sha3Uncles: string;
  logsBloom: string;
  transactionsRoot: string;
  stateRoot: string;
  receiptsRoot: string;
  miner: string;
  difficulty: string;
  totalDifficulty: string;
  extraData: string;
  size: string; // Hex size in bytes
  gasLimit: string; // Hex gas limit
  gasUsed: string; // Hex gas used
  timestamp: string; // Hex timestamp
  transactions: string[] | EtherscanTransactionObject[]; // Array of tx hashes or full tx objects
  uncles: string[];
  // Etherscan might add specific fields
  baseFeePerGas?: string; // EIP-1559
}

/**
 * Response for 'proxy' module, 'eth_getBlockByNumber' action.
 */
export interface EtherscanGetBlockByNumberResponse
  extends EtherscanBaseResponse {
  result: EtherscanBlockObject | null;
}

/**
 * Structure for an Ethereum Transaction object (simplified).
 * Based on https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_gettransactionbyhash
 */
export interface EtherscanTransactionObject {
  blockHash: string | null; // Null if pending
  blockNumber: string | null; // Null if pending, hex
  from: string;
  gas: string; // Hex
  gasPrice: string; // Hex
  maxFeePerGas?: string; // EIP-1559, hex
  maxPriorityFeePerGas?: string; // EIP-1559, hex
  hash: string;
  input: string;
  nonce: string; // Hex
  to: string | null; // Null for contract creation
  transactionIndex: string | null; // Null if pending, hex
  value: string; // Hex, value in wei
  type: string; // Hex, e.g., '0x0', '0x2' for EIP-1559
  accessList?: any[]; // EIP-2930
  chainId: string; // Hex
  v: string; // Hex signature component
  r: string; // Hex signature component
  s: string; // Hex signature component
  // Etherscan might add specific fields
  contractAddress?: string | null; // Address if contract creation
}

/**
 * Response for 'proxy' module, 'eth_getTransactionByHash' action.
 */
export interface EtherscanGetTransactionByHashResponse
  extends EtherscanBaseResponse {
  result: EtherscanTransactionObject | null;
}

/**
 * Response for 'proxy' module, 'eth_getTransactionByBlockNumberAndIndex' action.
 */
export interface EtherscanGetTransactionByBlockNumberAndIndexResponse
  extends EtherscanBaseResponse {
  result: EtherscanTransactionObject | null;
}

/**
 * Structure for an Ethereum Transaction Receipt object (simplified).
 * Based on https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_gettransactionreceipt
 */
export interface EtherscanTransactionReceiptObject {
  transactionHash: string;
  transactionIndex: string; // Hex
  blockHash: string;
  blockNumber: string; // Hex
  from: string;
  to: string | null; // Null for contract creation
  cumulativeGasUsed: string; // Hex
  gasUsed: string; // Hex
  contractAddress: string | null; // Address if contract creation, null otherwise
  logs: EtherscanLogEntry[]; // Array of log objects
  logsBloom: string;
  status: string; // Hex, '0x1' for success, '0x0' for failure
  effectiveGasPrice: string; // Hex
  type: string; // Hex transaction type
  // Etherscan might add specific fields
  root?: string; // Post-Byzantium, state root
}

/**
 * Response for 'proxy' module, 'eth_getTransactionReceipt' action.
 */
export interface EtherscanGetTransactionReceiptResponse
  extends EtherscanBaseResponse {
  result: EtherscanTransactionReceiptObject | null;
}

/**
 * Response for 'proxy' module, 'eth_sendRawTransaction' action.
 * Can return the hash on success, or an error object structure on failure.
 */
export interface EtherscanSendRawTransactionResponse
  extends EtherscanBaseResponse {
  // Result is typically the tx hash on success (status='1')
  // If status='0', result might contain error details, but often message holds the error.
  // Let's assume result is the hash string if status='1'.
  result: string | any; // Hex transaction hash or potentially error details if status=0
}

/**
 * Response for 'proxy' module, 'eth_estimateGas' action.
 * Can return the gas amount on success, or an error object structure on failure.
 */
export interface EtherscanEstimateGasResponse extends EtherscanBaseResponse {
  // Result is the hex gas amount on success (status='1')
  // If status='0', result might contain error details, but often message holds the error.
  result: string | any; // Hex gas amount or potentially error details if status=0
}

// --- Gas Tracker Module Types ---
// To be added later

// --- Stats Module Types ---
// To be added later
