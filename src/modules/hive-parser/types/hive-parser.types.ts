export type hiveBlockType = {
  previous: string;
  timestamp: string;
  witness: string;
  transaction_merkle_root: string;
  extensions: [];
  witness_signature: string;
  block_id: string;
  transactions: hiveTransactionType[];
  transaction_ids: string[];
};

export type hiveTransactionType = {
  ref_block_num: number;
  ref_block_prefix: number;
  expiration: string;
  operations: [string, hiveOperationDataType][];
  extensions: [];
  signatures: string[];
  transaction_id: string;
  block_num: number;
  transaction_num: number;
};

export type hiveOperationDataType = {
  required_auths: string[];
  required_posting_auths: [];
  id: string;
  json: string;
};

export type triggerType = {
  contractName: string;
  contractAction: string;
  contractPayload: {
    tokenPair: string;
    tokenSymbol: string;
    tokenAmount: string;
    tradeType: string;
    minAmountOut: string;
  };
  required_auths: string;
};
