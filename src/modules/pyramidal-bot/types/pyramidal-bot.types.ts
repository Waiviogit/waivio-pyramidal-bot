import { triggerType } from '../../hive-parser/types/hive-parser.types';
import {
  marketPoolParamsType,
  marketPoolType,
  tokenBalanceType,
  tokenParamsType,
} from '../../blockchain-api/types/hive-engine.types';
import { calculateOutputsType, jsonType } from './swap-output.types';

export type pyramidalBotType = {
  account: string;
  key: string;
  tokenPairs: string[];
  stableTokens: string[];
  stablePair: string;
  tokenSymbol: string;
  lowestAmountOutBound: number;
  startIncomeDifference: string;
  tokenPrecision: number;
  approachCoefficient: number;
};

export type handleSwapsType = {
  bot: pyramidalBotType;
  triggers: triggerType[];
  blockNumber: number;
};

export type hiveEngineResponsesType = [
  pools:
    | marketPoolType[]
    | marketPoolParamsType[]
    | tokenParamsType[]
    | tokenBalanceType[],
  params:
    | marketPoolType[]
    | marketPoolParamsType[]
    | tokenParamsType[]
    | tokenBalanceType[],
  tokens:
    | marketPoolType[]
    | marketPoolParamsType[]
    | tokenParamsType[]
    | tokenBalanceType[],
  balances:
    | marketPoolType[]
    | marketPoolParamsType[]
    | tokenParamsType[]
    | tokenBalanceType[],
];

export type getPoolToSwapType = {
  pools: marketPoolType[];
  bot: pyramidalBotType;
  buy?: boolean;
  stablePool: marketPoolType;
  tokens: tokenParamsType[];
  balances: tokenBalanceType[];
};

export type poolToSwapType = {
  coefficient: number;
  tokenPair: string;
  stableTokenSymbol: string;
  stableTokenPrecision: number;
  balance: string;
  poolPrecision: string;
  baseQuantity: string;
  quoteQuantity: string;
};

export type operationType = {
  incomeDifference: string;
  startAmountIn: string;
  buyOutputJson: jsonType;
  sellOutputJson: jsonType;
  equalizeOutputJson: jsonType;
};

export type getFirstProfitablePointType = calculateOutputsType & {
  operations: operationType[];
  prevIncomeDifference: string;
};

export type mostProfitablePointType = {
  approachCoefficient: number;
  lowerStartAmountIn: string;
  upperStartAmountIn: string;
  poolToBuy: poolToSwapType;
  poolsWithToken: marketPoolType[];
  tradeFeeMul: string;
  bot: pyramidalBotType;
  poolToSell: poolToSwapType;
  stablePool: marketPoolType;
  operations: operationType[];
  prevIncomeDifference: string;
};

export type updateSwapDataType = {
  triggers: triggerType[];
  transactionId: string;
  blockNumber: number;
  poolToBuy: poolToSwapType;
  poolToSell: poolToSwapType;
  stablePool: marketPoolType;
};

export type objectForRedisType = {
  baseQuantity: string;
  quoteQuantity: string;
  tokenPair: string;
  timestamp: number;
};
