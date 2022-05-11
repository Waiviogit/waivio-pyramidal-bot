import { Inject, Injectable } from '@nestjs/common';
import { triggerType } from '../../hive-parser/types/hive-parser.types';
import { IPyramidalBotDomain } from '../interfaces/domains/pyramidal-bot-domain.interface';
import _ from 'lodash';
import {
  POOL_FEE,
  PYRAMIDAL_BOTS,
  TWO_DAYS_IN_SECONDS,
} from '../constants/pyramidal-bot.constants';
import {
  checkTriggerSuccessSuccessType,
  getFirstProfitablePointType,
  getPoolToSwapType,
  handleSwapsType,
  hiveEngineResponsesType,
  mostProfitablePointType,
  objectForRedisType,
  operationType,
  poolToSwapType,
  pyramidalBotType,
  recalculateQuantitiesType,
  updateSwapDataType,
} from '../types/pyramidal-bot.types';
import { REDIS_PROVIDERS } from '../../../common/constants/providers';
import { HIVE_ENGINE_NODES } from '../../blockchain-api/constants/hive-engine.constants';
import BigNumber from 'bignumber.js';
import {
  marketPoolType,
  tokenBalanceType,
  tokenParamsType,
} from '../../blockchain-api/types/hive-engine.types';
import { SwapOutputService } from '../services/swap-output.service';
import { calculateOutputsType, jsonType } from '../types/swap-output.types';
import { BlockchainApiService } from '../../blockchain-api/services/blockchain-api.service';
import { PYRAMIDAL_BOT_KEYS } from '../../redis/constants/redis.constants';
import { IPyramidalBot } from '../../redis/interfaces/redis-client.interfaces';
import moment from 'moment';

@Injectable()
export class PyramidalBotDomain implements IPyramidalBotDomain {
  constructor(
    private readonly _blockchainApiServiceApi: BlockchainApiService,
    private readonly _swapOutputService: SwapOutputService,
    @Inject(REDIS_PROVIDERS.MAIN)
    private readonly _botClient: IPyramidalBot,
  ) {}

  async startPyramidalBot(
    triggers: triggerType[],
    blockNumber: number,
  ): Promise<void> {
    const pyramidalBots = _.filter(PYRAMIDAL_BOTS, (bot) =>
      _.some(triggers, (trigger) =>
        _.includes(bot.tokenPairs, trigger.contractPayload.tokenPair),
      ),
    );
    if (!pyramidalBots.length) return;

    for (const bot of pyramidalBots) {
      await this.handleSwaps({
        bot: _.cloneDeep(bot),
        triggers,
        blockNumber,
      });
    }
  }

  /** --------------------------PRIVATE METHODS----------------------------------------*/

  private async handleSwaps({
    bot,
    triggers,
    blockNumber,
  }: handleSwapsType): Promise<void> {
    console.time('hive engine requests');
    const [pools, params, tokens, balances] =
      await this._makeHiveEngineRequests(bot);
    console.timeEnd('hive engine requests');
    const isRequestError =
      !pools ||
      !params ||
      !tokens ||
      !balances ||
      !pools.length ||
      !params.length ||
      !tokens.length ||
      !balances.length;
    if (isRequestError) {
      console.error('-------error in pyramidalBot request');

      return;
    }

    const tradeFeeMul = _.get(params, '[0].tradeFeeMul', POOL_FEE);
    this._recalculateQuantities({
      triggers,
      pools: pools as unknown as marketPoolType[],
      tradeFeeMul,
      slippage: bot.slippage,
    });
    const poolsWithToken = _.filter(
      pools,
      (pool) => !_.includes(bot.stablePair, pool.tokenPair),
    );
    const stablePool = _.find(pools, (pool) =>
      _.includes(bot.stablePair, pool.tokenPair),
    );
    const poolToBuy = this._getPoolToSwap({
      pools: poolsWithToken,
      bot,
      buy: true,
      stablePool,
      tokens: tokens as unknown as tokenParamsType[],
      balances: balances as unknown as tokenBalanceType[],
    });
    const poolToSell = this._getPoolToSwap({
      pools: poolsWithToken,
      bot,
      stablePool,
      tokens: tokens as unknown as tokenParamsType[],
      balances: balances as unknown as tokenBalanceType[],
    });

    const operations: operationType[] = [];

    // this._getFirstProfitableSwapPoint({
    //   poolToBuy,
    //   poolsWithToken,
    //   tradeFeeMul,
    //   bot,
    //   poolToSell,
    //   stablePool,
    //   operations,
    //   startAmountIn: poolToBuy.balance,
    //   prevIncomeDifference: bot.startIncomeDifference,
    // });
    if (operations.length) {
      this._approachMostProfitableSwapPoint({
        poolToBuy,
        poolsWithToken,
        tradeFeeMul,
        bot,
        poolToSell,
        stablePool,
        operations,
        approachCoefficient: bot.approachCoefficient,
        prevIncomeDifference: operations[0].incomeDifference,
        lowerStartAmountIn: operations[0].startAmountIn,
        upperStartAmountIn: operations[0].startAmountIn,
      });

      console.time('broadcast');
      const result = await this._blockchainApiServiceApi.broadcastToChain(
        bot,
        this._getJsonsToBroadcast(operations[operations.length - 1]),
      );
      console.timeEnd('broadcast');
      if (!result) return;

      await this._updateDataInRedis({
        triggers,
        transactionId: result,
        blockNumber,
        poolToBuy,
        poolToSell,
        stablePool,
      });
    }
  }

  private async _makeHiveEngineRequests(
    bot: pyramidalBotType,
  ): Promise<hiveEngineResponsesType> {
    return Promise.all([
      this._blockchainApiServiceApi.makeHiveEngineRequest({
        params: {
          contract: 'marketpools',
          table: 'pools',
          query: { tokenPair: { $in: bot.tokenPairs } },
        },
        hostUrl: HIVE_ENGINE_NODES[1],
      }),
      this._blockchainApiServiceApi.makeHiveEngineRequest({
        params: {
          contract: 'marketpools',
          table: 'params',
          query: {},
        },
      }),
      this._blockchainApiServiceApi.makeHiveEngineRequest({
        params: {
          contract: 'tokens',
          table: 'tokens',
          query: {
            symbol: {
              $in: [bot.tokenSymbol, ...bot.stableTokens],
            },
          },
          offset: 0,
          limit: 1000,
        },
        hostUrl: HIVE_ENGINE_NODES[1],
      }),
      this._blockchainApiServiceApi.makeHiveEngineRequest({
        params: {
          contract: 'tokens',
          table: 'balances',
          query: { symbol: { $in: bot.stableTokens }, account: bot.account },
        },
        hostUrl: HIVE_ENGINE_NODES[1],
      }),
    ]);
  }

  private _getPoolToSwap({
    pools,
    bot,
    buy = false,
    stablePool,
    tokens,
    balances,
  }: getPoolToSwapType): poolToSwapType {
    const dataToCompare = [];
    const [stableBase] = stablePool.tokenPair.split(':');

    for (const pool of pools) {
      const [base, quote] = pool.tokenPair.split(':');
      base === bot.tokenSymbol
        ? dataToCompare.push({
            coefficient: pool.tokenPair.includes(stableBase)
              ? new BigNumber(pool.basePrice)
                  .multipliedBy(stablePool.basePrice)
                  .toFixed(Number(stablePool.precision))
              : new BigNumber(pool.basePrice)
                  .multipliedBy(stablePool.quotePrice)
                  .toFixed(Number(stablePool.precision)),
            tokenPair: pool.tokenPair,
            stableTokenSymbol: quote,
            stableTokenPrecision: _.find(
              tokens,
              (token) => token.symbol === quote,
            ).precision,
            balance: _.find(balances, (balance) => balance.symbol === quote)
              .balance,
            poolPrecision: pool.precision,
            baseQuantity: pool.baseQuantity,
            quoteQuantity: pool.quoteQuantity,
          })
        : dataToCompare.push({
            coefficient: pool.tokenPair.includes(stableBase)
              ? new BigNumber(pool.quotePrice)
                  .multipliedBy(stablePool.basePrice)
                  .toFixed(Number(stablePool.precision))
              : new BigNumber(pool.quotePrice)
                  .multipliedBy(stablePool.quotePrice)
                  .toFixed(Number(stablePool.precision)),
            tokenPair: pool.tokenPair,
            stableTokenSymbol: base,
            stableTokenPrecision: _.find(
              tokens,
              (token) => token.symbol === base,
            ).precision,
            balance: _.find(balances, (balance) => balance.symbol === base)
              .balance,
            poolPrecision: pool.precision,
            baseQuantity: pool.baseQuantity,
            quoteQuantity: pool.quoteQuantity,
          });
    }

    return buy
      ? dataToCompare.reduce((acc, current) =>
          acc.coefficient < current.coefficient ? acc : current,
        )
      : dataToCompare.reduce((acc, current) =>
          acc.coefficient > current.coefficient ? acc : current,
        );
  }

  private _recalculateQuantities({
    triggers,
    pools,
    tradeFeeMul,
    slippage,
  }: recalculateQuantitiesType): void {
    for (const trigger of triggers) {
      const pool = _.find(pools, (pool) =>
        _.includes(pool.tokenPair, trigger.contractPayload.tokenPair),
      );
      if (!pool) continue;

      const isTriggerSuccess = this._checkTriggerSuccess({
        trigger,
        pool,
        tradeFeeMul,
        slippage,
      });
      if (!isTriggerSuccess) continue;

      const [base] = pool.tokenPair.split(':');
      if (base === trigger.contractPayload.tokenPair) {
        pool.baseQuantity = new BigNumber(pool.baseQuantity)
          .plus(trigger.contractPayload.tokenAmount)
          .toFixed(Number(pool.precision));
        pool.quoteQuantity = new BigNumber(pool.quoteQuantity)
          .minus(trigger.contractPayload.minAmountOut)
          .toFixed(Number(pool.precision));
      } else {
        pool.baseQuantity = new BigNumber(pool.baseQuantity)
          .minus(trigger.contractPayload.minAmountOut)
          .toFixed(Number(pool.precision));
        pool.quoteQuantity = new BigNumber(pool.quoteQuantity)
          .plus(trigger.contractPayload.tokenAmount)
          .toFixed(Number(pool.precision));
      }
    }
  }

  private _getFirstProfitableSwapPoint({
    poolToBuy,
    poolsWithToken,
    tradeFeeMul,
    bot,
    poolToSell,
    stablePool,
    operations,
    startAmountIn,
    prevIncomeDifference,
  }: getFirstProfitablePointType): void {
    if (new BigNumber(startAmountIn).isLessThan(bot.lowestAmountOutBound)) {
      return;
    }

    const { buyOutput, sellOutput, equalizeOutput } =
      this._swapOutputService.calculateOutputs({
        poolToBuy,
        startAmountIn,
        poolsWithToken,
        tradeFeeMul,
        bot,
        poolToSell,
        stablePool,
      });
    const outputError = !buyOutput || !sellOutput || !equalizeOutput;
    if (outputError) return;

    const isAmountOutGreater =
      new BigNumber(equalizeOutput.amountOut).isGreaterThan(startAmountIn) &&
      !new BigNumber(startAmountIn).isLessThan(bot.lowestAmountOutBound);
    const isAmountOutLess =
      new BigNumber(equalizeOutput.amountOut).isLessThan(startAmountIn) &&
      !operations.length;

    if (isAmountOutGreater) {
      const incomeDifference = new BigNumber(equalizeOutput.amountOut)
        .minus(startAmountIn)
        .toFixed(poolToBuy.stableTokenPrecision);
      if (new BigNumber(incomeDifference).isLessThan(prevIncomeDifference))
        return;

      operations[0] = {
        incomeDifference,
        startAmountIn,
        buyOutputJson: buyOutput.json,
        sellOutputJson: sellOutput.json,
        equalizeOutputJson: equalizeOutput.json,
      };

      this._getFirstProfitableSwapPoint({
        poolToBuy,
        poolsWithToken,
        tradeFeeMul,
        bot,
        poolToSell,
        stablePool,
        operations,
        startAmountIn: new BigNumber(startAmountIn)
          .dividedBy(2)
          .toFixed(poolToBuy.stableTokenPrecision),
        prevIncomeDifference: incomeDifference,
      });
    } else if (isAmountOutLess) {
      this._getFirstProfitableSwapPoint({
        poolToBuy,
        poolsWithToken,
        tradeFeeMul,
        bot,
        poolToSell,
        stablePool,
        operations,
        startAmountIn: new BigNumber(startAmountIn)
          .dividedBy(2)
          .toFixed(poolToBuy.stableTokenPrecision),
        prevIncomeDifference,
      });
    }
  }

  private _approachMostProfitableSwapPoint({
    poolToBuy,
    poolsWithToken,
    tradeFeeMul,
    bot,
    poolToSell,
    stablePool,
    operations,
    approachCoefficient,
    prevIncomeDifference,
    lowerStartAmountIn,
    upperStartAmountIn,
  }: mostProfitablePointType): void {
    let lowerIncomeDifferenceObject;
    let upperIncomeDifferenceObject;

    if (lowerStartAmountIn) {
      lowerStartAmountIn = new BigNumber(lowerStartAmountIn)
        .multipliedBy(approachCoefficient)
        .toFixed(poolToBuy.stableTokenPrecision);

      const isOutOfRange = new BigNumber(lowerStartAmountIn).isLessThan(
        new BigNumber(operations[0].startAmountIn).div(2),
      );
      if (isOutOfRange) return;

      lowerIncomeDifferenceObject = this._getIncomeDifference({
        poolToBuy,
        startAmountIn: lowerStartAmountIn,
        poolsWithToken,
        tradeFeeMul,
        bot,
        poolToSell,
        stablePool,
      });
    }

    if (upperStartAmountIn) {
      upperStartAmountIn = new BigNumber(upperStartAmountIn)
        .dividedBy(approachCoefficient)
        .toFixed(poolToBuy.stableTokenPrecision);

      const isOutOfRange =
        new BigNumber(upperStartAmountIn).isGreaterThan(
          new BigNumber(operations[0].startAmountIn).times(2),
        ) || new BigNumber(upperStartAmountIn).isGreaterThan(poolToBuy.balance);
      if (isOutOfRange) return;

      upperIncomeDifferenceObject = this._getIncomeDifference({
        poolToBuy,
        startAmountIn: upperStartAmountIn,
        poolsWithToken,
        tradeFeeMul,
        bot,
        poolToSell,
        stablePool,
      });
    }

    const incomeDifferenceObject = this._pickIncomeDifferenceObject(
      lowerIncomeDifferenceObject,
      upperIncomeDifferenceObject,
    );

    const isAmountOutGreater =
      new BigNumber(incomeDifferenceObject.incomeDifference).isGreaterThan(
        operations[0].incomeDifference,
      ) &&
      new BigNumber(incomeDifferenceObject.incomeDifference).isGreaterThan(
        prevIncomeDifference,
      );

    if (isAmountOutGreater) {
      operations[1] = {
        incomeDifference: incomeDifferenceObject.incomeDifference,
        startAmountIn: incomeDifferenceObject.startAmountIn,
        buyOutputJson: incomeDifferenceObject.buyOutputJson,
        sellOutputJson: incomeDifferenceObject.sellOutputJson,
        equalizeOutputJson: incomeDifferenceObject.equalizeOutputJson,
      };

      this._approachMostProfitableSwapPoint({
        poolToBuy,
        poolsWithToken,
        tradeFeeMul,
        bot,
        poolToSell,
        stablePool,
        operations,
        approachCoefficient,
        prevIncomeDifference: incomeDifferenceObject.incomeDifference,
        lowerStartAmountIn:
          incomeDifferenceObject === lowerIncomeDifferenceObject
            ? incomeDifferenceObject.startAmountIn
            : '',
        upperStartAmountIn:
          incomeDifferenceObject === upperIncomeDifferenceObject
            ? incomeDifferenceObject.startAmountIn
            : '',
      });
    }
  }

  private _getIncomeDifference({
    poolToBuy,
    startAmountIn,
    poolsWithToken,
    tradeFeeMul,
    bot,
    poolToSell,
    stablePool,
  }: calculateOutputsType): operationType {
    const { buyOutput, sellOutput, equalizeOutput } =
      this._swapOutputService.calculateOutputs({
        poolToBuy,
        startAmountIn,
        poolsWithToken,
        tradeFeeMul,
        bot,
        poolToSell,
        stablePool,
      });

    return {
      incomeDifference: new BigNumber(equalizeOutput.amountOut)
        .minus(startAmountIn)
        .toFixed(poolToBuy.stableTokenPrecision),
      startAmountIn,
      buyOutputJson: buyOutput.json,
      sellOutputJson: sellOutput.json,
      equalizeOutputJson: equalizeOutput.json,
    };
  }

  private _pickIncomeDifferenceObject(
    lowerIncomeDifferenceObject,
    upperIncomeDifferenceObject,
  ): operationType {
    if (!lowerIncomeDifferenceObject) return upperIncomeDifferenceObject;

    if (!upperIncomeDifferenceObject) return lowerIncomeDifferenceObject;

    return new BigNumber(
      lowerIncomeDifferenceObject.incomeDifference,
    ).isGreaterThan(upperIncomeDifferenceObject.incomeDifference)
      ? lowerIncomeDifferenceObject
      : upperIncomeDifferenceObject;
  }

  private _getJsonsToBroadcast(
    object: operationType,
  ): [jsonType, jsonType, jsonType] {
    return [
      object.buyOutputJson,
      object.sellOutputJson,
      object.equalizeOutputJson,
    ];
  }

  private async _updateDataInRedis({
    triggers,
    transactionId,
    blockNumber,
    poolToBuy,
    poolToSell,
    stablePool,
  }: updateSwapDataType): Promise<void> {
    /** clear sorted set from members older than a day */
    await this._botClient.zremrangebyscore({
      key: PYRAMIDAL_BOT_KEYS.triggers,
      min: 1,
      max: blockNumber - 30000,
    });

    /** setting data to redis to check triggers */
    await this._botClient.zadd({
      key: PYRAMIDAL_BOT_KEYS.triggers,
      value: JSON.stringify({ triggers, transactionId }),
      score: blockNumber,
    });

    const timestamp = moment.utc().unix();
    /** save hashes with pools data  and set ttl to delete old hashes */
    for (let count = 0; count < 3; count++) {
      let data;
      const key = `${count}:${transactionId}-${count}`;

      if (count === 0) data = this._getObjectForRedis(poolToBuy, timestamp);
      if (count === 1) data = this._getObjectForRedis(poolToSell, timestamp);
      if (count === 2) data = this._getObjectForRedis(stablePool, timestamp);
      await this._botClient.hset(key, data);
      await this._botClient.expire(key, TWO_DAYS_IN_SECONDS);
    }
  }

  private _getObjectForRedis(
    pool: poolToSwapType | marketPoolType,
    timestamp: number,
  ): objectForRedisType {
    return {
      baseQuantity: pool.baseQuantity,
      quoteQuantity: pool.quoteQuantity,
      tokenPair: pool.tokenPair,
      timestamp,
    };
  }

  private _checkTriggerSuccess({
    trigger,
    pool,
    tradeFeeMul,
    slippage,
  }: checkTriggerSuccessSuccessType): boolean {
    const output = this._swapOutputService.getSwapOutput({
      symbol: trigger.contractPayload.tokenSymbol,
      amountIn: trigger.contractPayload.tokenAmount,
      pool,
      slippage,
      tradeFeeMul,
      precision: pool.precision,
    });
    if (new BigNumber(output.amountOut).isLessThan(trigger.contractPayload.minAmountOut)) {
      return false;
    }

    return true;
  }
}
