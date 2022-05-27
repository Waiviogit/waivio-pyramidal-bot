import { Injectable } from '@nestjs/common';
import BigNumber from 'bignumber.js';
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
    triggers,
  }: calculateOutputsType): {
    sellOutput: swapOutputType;
    buyOutput: swapOutputType;
    equalizeOutput: swapOutputType;
  } {
    const buyOutput = this.getSwapOutput({
      symbol: poolToBuy.stableTokenSymbol,
      amountIn: startAmountIn,
      pool: poolsWithToken.find((pool) =>
        pool.tokenPair.includes(poolToBuy.tokenPair),
      ),
      slippage: triggers.find((trigger) =>
        trigger.contractPayload.tokenPair.includes(poolToBuy.tokenPair),
      )
        ? bot.slippage
        : bot.lowerSlippage,
      tradeFeeMul,
      precision: poolToBuy.poolPrecision,
    });
    const sellOutput = this.getSwapOutput({
      symbol: bot.tokenSymbol,
      amountIn: new BigNumber(buyOutput.minAmountOut).toFixed(
        bot.tokenPrecision,
      ),
      pool: poolsWithToken.find((pool) =>
        pool.tokenPair.includes(poolToSell.tokenPair),
      ),
      slippage: triggers.find((trigger) =>
        trigger.contractPayload.tokenPair.includes(poolToSell.tokenPair),
      )
        ? bot.slippage
        : bot.lowerSlippage,
      tradeFeeMul,
      precision: poolToSell.poolPrecision,
    });
    const equalizeOutput = this.getSwapOutput({
      symbol: poolToSell.stableTokenSymbol,
      amountIn: new BigNumber(sellOutput.minAmountOut).toFixed(
        poolToSell.stableTokenPrecision,
      ),
      pool: stablePool,
      slippage: triggers.find((trigger) =>
        trigger.contractPayload.tokenPair.includes(stablePool.tokenPair),
      )
        ? bot.slippage
        : bot.lowerSlippage,
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
