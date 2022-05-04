import { Injectable, Logger } from '@nestjs/common';
import { CONDENSER_API, HIVE_RPC_NODES } from '../constants/hive-api.constants';
import { hiveBlockType } from '../../hive-parser/types/hive-parser.types';
import axios from 'axios';
import _ from 'lodash';
import {
  broadcastType,
  engineProxyType,
  engineQueryType,
  marketPoolParamsType,
  marketPoolType,
  tokenBalanceType,
  tokenParamsType,
} from '../types/hive-engine.types';
import { HIVE_ENGINE_NODES } from '../constants/hive-engine.constants';
import { pyramidalBotType } from '../../pyramidal-bot/types/pyramidal-bot.types';
import { Client, PrivateKey } from '@hiveio/dhive';
import { jsonType } from '../../pyramidal-bot/types/swap-output.types';

@Injectable()
export class BlockchainApiService {
  private readonly logger = new Logger(BlockchainApiService.name);
  private readonly hiveNodes: string[] = HIVE_RPC_NODES;
  private url = this.hiveNodes[0];
  private readonly _client;
  constructor() {
    this._client = new Client(HIVE_RPC_NODES, {
      failoverThreshold: 0,
      timeout: 10 * 1000,
    });
  }

  async getBlock(blockNumber: number): Promise<hiveBlockType | undefined> {
    return this._hiveRequest(CONDENSER_API.GET_BLOCK, [blockNumber]);
  }

  async makeHiveEngineRequest({
    hostUrl,
    method,
    params,
    endpoint,
    id,
    attempts = 5,
  }: engineProxyType): Promise<
    | [marketPoolType]
    | [marketPoolParamsType]
    | [tokenParamsType]
    | [tokenBalanceType]
  > {
    const response = await this._engineQuery({
      hostUrl,
      method,
      params,
      endpoint,
      id,
    });
    if (!response) {
      if (attempts <= 0) return response;

      return this.makeHiveEngineRequest({
        hostUrl: this._getNewEngineNodeUrl(hostUrl),
        method,
        params,
        endpoint,
        id,
        attempts: attempts - 1,
      });
    }

    return response;
  }

  async broadcastToChain(
    bot: pyramidalBotType,
    operations: jsonType[],
  ): Promise<string> {
    return this._broadcastJson({
      json: JSON.stringify(operations),
      required_auths: [bot.account],
      key: bot.key,
    });
  }
  /** --------------------------PRIVATE METHODS----------------------------------------*/

  private _changeNode(): void {
    const index = this.hiveNodes.indexOf(this.url);
    this.url =
      this.hiveNodes.length - 1 === index
        ? this.hiveNodes[0]
        : this.hiveNodes[index + 1];
    this.logger.error(`Node URL was changed to ${this.url}`);
  }

  private async _hiveRequest(method: string, params: unknown) {
    try {
      const resp = await axios.post(
        this.url,
        { jsonrpc: '2.0', method, params, id: 1 },
        { timeout: 8000 },
      );
      if (resp?.data?.error) {
        this._changeNode();
      }

      return resp?.data?.result;
    } catch (error) {
      this.logger.error(error.message);
      this._changeNode();
    }
  }

  private async _engineQuery({
    hostUrl = 'https://api.hive-engine.com/rpc',
    method = 'find',
    params,
    endpoint = '/contracts',
    id = 'ssc-mainnet-hive',
  }: engineQueryType): Promise<
    | [marketPoolType]
    | [marketPoolParamsType]
    | [tokenParamsType]
    | [tokenBalanceType]
  > {
    try {
      const instance = axios.create();
      const resp = await instance.post(`${hostUrl}${endpoint}`, {
        jsonrpc: '2.0',
        method,
        params,
        id,
      });

      return _.get(resp, 'data.result');
    } catch (error) {
      this.logger.error(error.message);
    }
  }

  private _getNewEngineNodeUrl(hostUrl: string): string {
    const index = hostUrl ? HIVE_ENGINE_NODES.indexOf(hostUrl) : 0;

    return index === HIVE_ENGINE_NODES.length - 1
      ? HIVE_ENGINE_NODES[0]
      : HIVE_ENGINE_NODES[index + 1];
  }

  private async _broadcastJson({
    id = 'ssc-mainnet-hive',
    json,
    key,
    required_auths = [],
    required_posting_auths = [],
  }: broadcastType): Promise<string> {
    try {
      const result = await this._client.broadcast.json(
        {
          id,
          json,
          required_auths,
          required_posting_auths,
        },
        PrivateKey.fromString(key),
      );
      console.log(result);

      if (result) return _.get(result, 'id');
    } catch (error) {
      console.error(error.message);
    }
  }
}
