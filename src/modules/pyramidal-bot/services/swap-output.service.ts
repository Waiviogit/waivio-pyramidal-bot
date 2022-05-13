import { Injectable } from '@nestjs/common';
import BigNumber from 'bignumber.js';
import _ from 'lodash';
import {
  calculateFeeType,
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
      amountIn: new BigNumber(_.get(buyOutput, 'minAmountOut')).toFixed(
        bot.tokenPrecision,
      ),
      pool: _.find(poolsWithToken, (pool) =>
        pool.tokenPair.includes(poolToSell.tokenPair),
      ),
      slippage: 0.005,
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

    const { baseQuantity, quoteQuantity, tokenPair, basePrice, quotePrice } =
      pool;
    const [baseSymbol] = tokenPair.split(':');
    const isBase = symbol === baseSymbol;
    const priceImpact = isBase
      ? new BigNumber(amountIn)
          .times(100)
          .div(new BigNumber(baseQuantity).plus(amountIn).toFixed())
          .toFixed(Number(precision), BigNumber.ROUND_UP)
      : new BigNumber(amountIn)
          .times(100)
          .div(new BigNumber(quoteQuantity).plus(amountIn).toFixed())
          .toFixed(Number(precision), BigNumber.ROUND_UP);
    const newPrice = isBase
      ? new BigNumber(basePrice)
          .minus(priceImpact)
          .toFixed(Number(precision), BigNumber.ROUND_DOWN)
      : new BigNumber(quotePrice)
          .minus(priceImpact)
          .toFixed(Number(precision), BigNumber.ROUND_DOWN);
    const amountOut = new BigNumber(amountIn)
      .multipliedBy(newPrice)
      .toFixed(Number(precision), BigNumber.ROUND_DOWN);

    let liquidityIn;
    let liquidityOut;
    if (isBase) {
      liquidityIn = pool.baseQuantity;
      liquidityOut = pool.quoteQuantity;
    } else {
      liquidityIn = pool.quoteQuantity;
      liquidityOut = pool.baseQuantity;
    }
    const fee = this._calcFee({
      tokenAmount: amountIn,
      tradeFeeMul,
      precision,
      liquidityIn,
      liquidityOut,
    });
    //
    // const tokenToExchange = isBase ? baseQuantity : quoteQuantity;
    //
    // const tokenExchangedOn = isBase ? quoteQuantity : baseQuantity;
    //
    // const absoluteValue = new BigNumber(tokenToExchange).times(
    //   tokenExchangedOn,
    // );
    //
    // const tokenAmount = new BigNumber(amountIn).toFixed();
    //
    // const slippageAmount = new BigNumber(tokenAmount).times(slippage);
    //
    // const fee = this._calcFee({
    //   tokenAmount,
    //   liquidityIn,
    //   liquidityOut,
    //   precision,
    //   tradeFeeMul,
    // });
    //
    // const tokenToExchangeNewBalance = new BigNumber(
    //   new BigNumber(tokenToExchange).plus(amountIn),
    // )
    //   .minus(fee)
    //   .toFixed(Number(precision), BigNumber.ROUND_DOWN);
    // const tokenExchangedOnNewBalance = absoluteValue.div(
    //   tokenToExchangeNewBalance,
    // );
    // const amountOut = new BigNumber(tokenExchangedOn)
    //   .minus(tokenExchangedOnNewBalance)
    //   .absoluteValue();
    //

    //
    // const newBalances = {
    //   tokenToExchange: tokenToExchangeNewBalance,
    //   tokenExchangedOn: tokenExchangedOnNewBalance.toFixed(
    //     Number(precision),
    //     BigNumber.ROUND_DOWN,
    //   ),
    // };
    //
    // const newPrices = {
    //   tokenToExchange: new BigNumber(tokenToExchangeNewBalance)
    //     .div(tokenExchangedOnNewBalance)
    //     .toFixed(Number(precision), BigNumber.ROUND_DOWN),
    //   tokenExchangedOn: tokenExchangedOnNewBalance
    //     .div(tokenToExchangeNewBalance)
    //     .toFixed(Number(precision), BigNumber.ROUND_DOWN),
    // };
    //

    // const amountOutToFixed = amountOut
    //   .minus(priceImpactFee)
    //   .toFixed(Number(precision), BigNumber.ROUND_DOWN);
    //
    // const minAmountOut = amountOut.minus(slippageAmount);
    // const priceImpactFeeForMinAmount = new BigNumber(priceImpact)
    //   .div(100)
    //   .times(fee);
    // const minAmountOutToFixed = minAmountOut
    //   .minus(priceImpactFeeForMinAmount)
    //   .minus(fee)
    //   .toFixed(Number(precision), BigNumber.ROUND_DOWN);
    // const priceImpactFee = new BigNumber(priceImpact)
    //   .div(100)
    //   .times(fee)
    //   .toFixed(Number(precision), BigNumber.ROUND_UP);
    const amountOutToFixed = new BigNumber(amountOut)
      .minus(fee)
      .toFixed(Number(precision), BigNumber.ROUND_DOWN);
    const minAmountOut = new BigNumber(amountOutToFixed)
      .minus(
        new BigNumber(amountOutToFixed)
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
      // fee,
      //  priceImpact: priceImpact.toFixed(2),
      minAmountOut,
      amountOut: amountOutToFixed,
      //   newBalances,
      //   newPrices,
      json,
    };
  }

  /** --------------------------PRIVATE METHODS----------------------------------------*/

  private _calcFee({
    tokenAmount,
    liquidityIn,
    liquidityOut,
    precision,
    tradeFeeMul,
  }: calculateFeeType): string {
    const tokenAmountAdjusted = new BigNumber(
      this._getAmountOut({
        tokenAmount,
        liquidityIn,
        liquidityOut,
        tradeFeeMul,
      }),
    );
    const fee = new BigNumber(tokenAmountAdjusted)
      .dividedBy(tradeFeeMul)
      .minus(tokenAmountAdjusted)
      .toFixed(Number(precision), BigNumber.ROUND_HALF_UP);

    return fee;
  }

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
