import { marketPoolType } from '../../blockchain-api/types/hive-engine.types';
import { poolToSwapType, pyramidalBotType } from './pyramidal-bot.types';
import BigNumber from 'bignumber.js';
import { triggerType } from '../../hive-parser/types/hive-parser.types';

export type calculateOutputsType = {
  poolToBuy: poolToSwapType;
  startAmountIn: string;
  poolsWithToken: marketPoolType[];
  tradeFeeMul: string;
  bot: pyramidalBotType;
  poolToSell: poolToSwapType;
  stablePool: marketPoolType;
  triggers: triggerType[];
};

export type getSwapOutputType = {
  symbol: string;
  amountIn: string;
  pool: marketPoolType;
  slippage: number;
  tradeFeeMul: string;
  precision: string;
};

export type getAmountOut = {
  tokenAmount: string | BigNumber;
  liquidityIn: string;
  liquidityOut: string;
  tradeFeeMul: string;
};

export type operationForJsonType = {
  tokenPair: string;
  minAmountOut: string;
  tokenSymbol: string;
  tokenAmount: string;
};

export type jsonType = {
  contractAction: string;
  contractPayload: {
    tokenSymbol: string;
    tokenAmount: string;
    minAmountOut: string;
    tradeType: string;
    tokenPair: string;
  };
  contractName: string;
};

export type swapOutputType = {
  json: jsonType;
  minAmountOut: string;
  amountOut: string;
};
