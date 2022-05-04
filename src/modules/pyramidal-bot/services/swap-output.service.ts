import { Injectable } from '@nestjs/common';
import { SLIPPAGE } from '../constants/pyramidal-bot.constants';
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
    const buyOutput = this._getSwapOutput({
      symbol: poolToBuy.stableTokenSymbol,
      amountIn: startAmountIn,
      pool: _.find(poolsWithToken, (pool) =>
        pool.tokenPair.includes(poolToBuy.tokenPair),
      ),
      slippage: SLIPPAGE,
      from: true,
      tradeFeeMul,
      precision: poolToBuy.poolPrecision,
    });
    const sellOutput = this._getSwapOutput({
      symbol: bot.tokenSymbol,
      amountIn: new BigNumber(_.get(buyOutput, 'minAmountOut')).toFixed(
        bot.tokenPrecision,
      ),
      pool: _.find(poolsWithToken, (pool) =>
        pool.tokenPair.includes(poolToSell.tokenPair),
      ),
      slippage: SLIPPAGE,
      from: true,
      tradeFeeMul,
      precision: poolToSell.poolPrecision,
    });
    const equalizeOutput = this._getSwapOutput({
      symbol: poolToSell.stableTokenSymbol,
      amountIn: new BigNumber(_.get(sellOutput, 'minAmountOut')).toFixed(
        poolToSell.stableTokenPrecision,
      ),
      pool: stablePool,
      slippage: SLIPPAGE,
      from: true,
      tradeFeeMul,
      precision: stablePool.precision,
    });

    return { buyOutput, sellOutput, equalizeOutput };
  }

  private _getSwapOutput({
    symbol,
    amountIn,
    pool,
    slippage,
    from,
    tradeFeeMul,
    precision,
  }: getSwapOutputType): swapOutputType {
    if (!pool) return;

    let liquidityIn;
    let liquidityOut;

    const { baseQuantity, quoteQuantity, tokenPair } = pool;
    const [baseSymbol, quoteSymbol] = tokenPair.split(':');
    const isBase = symbol === baseSymbol;

    const tokenToExchange = isBase ? baseQuantity : quoteQuantity;

    const tokenExchangedOn = isBase ? quoteQuantity : baseQuantity;

    const absoluteValue = new BigNumber(tokenToExchange).times(
      tokenExchangedOn,
    );
    const tokenToExchangeNewBalance = from
      ? new BigNumber(tokenToExchange).plus(amountIn)
      : new BigNumber(tokenToExchange).minus(amountIn);

    const tokenExchangedOnNewBalance = absoluteValue.div(
      tokenToExchangeNewBalance,
    );
    const amountOut = new BigNumber(tokenExchangedOn)
      .minus(tokenExchangedOnNewBalance)
      .absoluteValue();

    const priceImpact = from
      ? new BigNumber(amountIn).times(100).div(tokenToExchange)
      : new BigNumber(amountOut).times(100).div(tokenExchangedOn);

    const newBalances = {
      tokenToExchange: tokenToExchangeNewBalance.toFixed(
        Number(precision),
        BigNumber.ROUND_DOWN,
      ),
      tokenExchangedOn: tokenExchangedOnNewBalance.toFixed(
        Number(precision),
        BigNumber.ROUND_DOWN,
      ),
    };

    const newPrices = {
      tokenToExchange: tokenToExchangeNewBalance
        .div(tokenExchangedOnNewBalance)
        .toFixed(Number(precision), BigNumber.ROUND_DOWN),
      tokenExchangedOn: tokenExchangedOnNewBalance
        .div(tokenToExchangeNewBalance)
        .toFixed(Number(precision), BigNumber.ROUND_DOWN),
    };

    const tokenSymbol = from
      ? symbol
      : symbol === baseSymbol
      ? quoteSymbol
      : baseSymbol;

    const tradeDirection = tokenSymbol === baseSymbol;
    if (tradeDirection) {
      liquidityIn = pool.baseQuantity;
      liquidityOut = pool.quoteQuantity;
    } else {
      liquidityIn = pool.quoteQuantity;
      liquidityOut = pool.baseQuantity;
    }

    const tokenAmount = from ? new BigNumber(amountIn).toFixed() : amountOut;

    const slippageAmount = from
      ? amountOut.times(slippage)
      : new BigNumber(amountIn).times(slippage);

    const fee = this._calcFee({
      tokenAmount,
      liquidityIn,
      liquidityOut,
      precision,
      tradeFeeMul,
    });
    const minAmountOut = from
      ? amountOut.minus(slippageAmount)
      : new BigNumber(amountIn).minus(slippageAmount);

    let amountOutToFixed;
    if (from) {
      amountOutToFixed = amountOut
        .minus(fee)
        .toFixed(Number(precision), BigNumber.ROUND_DOWN);
    } else {
      const feeAmount = this._calcFee({
        tokenAmount: amountIn,
        liquidityIn: tokenToExchangeNewBalance.toFixed(),
        liquidityOut: tokenExchangedOnNewBalance.toFixed(),
        precision,
        tradeFeeMul,
      });
      const tradeFee = new BigNumber(feeAmount).times(0.025);
      const priceImpactFee = new BigNumber(priceImpact)
        .div(100)
        .times(feeAmount);

      amountOutToFixed = new BigNumber(amountOut)
        .plus(tradeFee)
        .plus(feeAmount)
        .plus(priceImpactFee)
        .toFixed();
    }

    const priceImpactFeeForMinAmount = new BigNumber(priceImpact)
      .div(100)
      .times(fee);
    const minAmountOutToFixed = minAmountOut
      .minus(fee)
      .minus(priceImpactFeeForMinAmount)
      .toFixed(Number(precision), BigNumber.ROUND_DOWN);

    const json = this._operationForJson({
      minAmountOut: minAmountOutToFixed,
      tokenPair,
      tokenSymbol,
      tokenAmount: new BigNumber(tokenAmount).toFixed(
        Number(precision),
        BigNumber.ROUND_DOWN,
      ),
    });

    return {
      fee,
      priceImpact: priceImpact.toFixed(2),
      minAmountOut: minAmountOutToFixed,
      amountOut: amountOutToFixed,
      newBalances,
      newPrices,
      json,
    };
  }

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
