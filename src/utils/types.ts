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
  methodId?: string;      // Optional, added by Etherscan if available
  functionName?: string;  // Optional, added by Etherscan if available
}

/**
 * Response for 'account' module, 'txlist' action (normal transactions).
 */
export interface EtherscanTxListResponse extends EtherscanBaseResponse {
  result: EtherscanNormalTransaction[];
}

// We will add more specific response types here later for other modules (Contracts, Logs, etc.)
