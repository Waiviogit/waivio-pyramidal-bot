export type engineQueryType = {
  hostUrl?: string;
  method?: string;
  endpoint?: string;
  id?: string;
  params: engineParamsType;
};

export type engineParamsType = {
  contract: string;
  table: string;
  query?: object;
  offset?: number;
  limit?: number;
};

export type engineProxyType = engineQueryType & {
  attempts?: number;
};

export type marketPoolType = {
  _id: string;
  tokenPair: string;
  baseQuantity: string;
  quoteQuantity: string;
  basePrice: string;
  quotePrice: string;
  baseVolume: string;
  quoteVolume: string;
  totalShares: string;
  precision: string;
  creator: string;
};

export type marketPoolParamsType = {
  _id: number;
  poolCreationFee: string;
  updateIndex: number;
  tradeFeeMul: string;
};

export type tokenParamsType = {
  _id: number;
  issuer: string;
  symbol: string;
  name: string;
  metadata: string;
  precision: number;
  maxSupply: string;
  supply: string;
  circulatingSupply: string;
  stakingEnabled: boolean;
  unstakingCooldown: number;
  delegationEnabled: boolean;
  undelegationCooldown: number;
};

export type tokenBalanceType = {
  _id: number;
  account: string;
  symbol: string;
  balance: string;
  stake: string;
  pendingUnstake: string;
  delegationsIn: string;
  delegationsOut: string;
  pendingUndelegations: string;
};

export type broadcastType = {
  id?: string;
  json: string;
  required_auths: string[];
  required_posting_auths?: [];
  key: string;
};
