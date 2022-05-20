import { Injectable } from '@nestjs/common';
import BigNumber from 'bignumber.js';
import _ from 'lodash';
import {
  calculateOutputsType,
  getAmountOut,
  getSwapOutputType,
  jsonType,
  operationForJsonType,
  swapOutputType,
} from '../types/swap-output.types';

@Injectable()
export class SwapOutputService {
  constructor() {}

  calculateOutputs({
    poolToBuy,
    startAmountIn,
    poolsWithToken,
    tradeFeeMul,
    bot,
    poolToSell,
    stablePool,
  }: calculateOutputsType): {
    sellOutput: swapOutputType;
    buyOutput: swapOutputType;
    equalizeOutput: swapOutputType;
  } {
    const buyOutput = this.getSwapOutput({
      symbol: poolToBuy.stableTokenSymbol,
      amountIn: startAmountIn,
      pool: _.find(poolsWithToken, (pool) =>
        pool.tokenPair.includes(poolToBuy.tokenPair),
      ),
      slippage: bot.slippage,
      tradeFeeMul,
      precision: poolToBuy.poolPrecision,
    });
    const sellOutput = this.getSwapOutput({
      symbol: bot.tokenSymbol,
      amountIn: new BigNumber(_.get(buyOutput, 'amountOut')).toFixed(
        bot.tokenPrecision,
      ),
      pool: _.find(poolsWithToken, (pool) =>
        pool.tokenPair.includes(poolToSell.tokenPair),
      ),
      slippage: bot.slippage,
      tradeFeeMul,
      precision: poolToSell.poolPrecision,
    });
    const equalizeOutput = this.getSwapOutput({
      symbol: poolToSell.stableTokenSymbol,
      amountIn: new BigNumber(_.get(sellOutput, 'amountOut')).toFixed(
        poolToSell.stableTokenPrecision,
      ),
      pool: stablePool,
      slippage: bot.slippage,
      tradeFeeMul,
      precision: stablePool.precision,
    });

    return { buyOutput, sellOutput, equalizeOutput };
  }

  getSwapOutput({
    symbol,
    amountIn,
    pool,
    slippage,
    tradeFeeMul,
    precision,
  }: getSwapOutputType): swapOutputType {
    if (!pool) return;

    const { baseQuantity, quoteQuantity, tokenPair } = pool;
    const [baseSymbol] = tokenPair.split(':');

    let liquidityIn;
    let liquidityOut;
    const isBase = symbol === baseSymbol;
    if (isBase) {
      liquidityIn = baseQuantity;
      liquidityOut = quoteQuantity;
    } else {
      liquidityIn = quoteQuantity;
      liquidityOut = baseQuantity;
    }

    const amountOut = new BigNumber(
      this._getAmountOut({
        tradeFeeMul,
        tokenAmount: amountIn,
        liquidityIn,
        liquidityOut,
      }),
    ).toFixed(Number(precision), BigNumber.ROUND_DOWN);
    const minAmountOut = new BigNumber(amountOut)
      .minus(
        new BigNumber(amountOut)
          .multipliedBy(slippage)
          .toFixed(Number(precision), BigNumber.ROUND_DOWN),
      )
      .toFixed(Number(precision), BigNumber.ROUND_DOWN);

    const json = this._operationForJson({
      minAmountOut,
      tokenPair,
      tokenSymbol: symbol,
      tokenAmount: amountIn,
    });

    return {
      minAmountOut,
      amountOut,
      json,
    };
  }

  /** --------------------------PRIVATE METHODS----------------------------------------*/

  private _getAmountOut({
    tokenAmount,
    liquidityIn,
    liquidityOut,
    tradeFeeMul,
  }: getAmountOut): BigNumber {
    const amountInWithFee = new BigNumber(tokenAmount).times(tradeFeeMul);
    const num = new BigNumber(amountInWithFee).times(liquidityOut);
    const den = new BigNumber(liquidityIn).plus(amountInWithFee);

    return num.dividedBy(den);
  }

  private _operationForJson({
    tokenPair,
    minAmountOut,
    tokenSymbol,
    tokenAmount,
  }: operationForJsonType): jsonType {
    return {
      contractName: 'marketpools',
      contractAction: 'swapTokens',
      contractPayload: {
        tokenPair,
        tokenSymbol,
        tokenAmount,
        tradeType: 'exactInput',
        minAmountOut,
      },
    };
  }
}
