import { Inject, Injectable, Logger } from '@nestjs/common';
import { REDIS_KEY } from '../../redis/constants/redis.constants';
import { DEFAULT_START_BLOCK_CAMPAIGN } from '../constants/processor.constants';
import { IHiveParserDomain } from '../../hive-parser/interfaces/domains/hive-parser-domain.interface';
import {
  HIVE_PARSER_PROVIDERS,
  REDIS_PROVIDERS,
} from '../../../common/constants/providers';
import { IBlockProcessor } from '../../redis/interfaces/redis-client.interfaces';
import { BlockchainApiService } from '../../blockchain-api/services/blockchain-api.service';
import { SocketClient } from '../../socket/socket.client';

@Injectable()
export class BlockProcessorService {
  private _currentBlock: number;
  private readonly _logger = new Logger(BlockProcessorService.name);
  private readonly _redisBlockKey: string = REDIS_KEY.LAST_BLOCK;
  private readonly _startDefaultBlock: number = DEFAULT_START_BLOCK_CAMPAIGN;

  constructor(
    @Inject(REDIS_PROVIDERS.MAIN)
    private readonly _processorClient: IBlockProcessor,
    private readonly _hiveApiDomain: BlockchainApiService,
    @Inject(HIVE_PARSER_PROVIDERS.MAIN)
    private readonly _hiveParserDomain: IHiveParserDomain,
    private readonly _socketClient: SocketClient,
  ) {}

   async start(): Promise<void> {
    await setTimeout(async () => this._loadNextBlock(), 1000);
  }

  /** --------------------------PRIVATE METHODS----------------------------------------*/

  private async _loadNextBlock(): Promise<void> {
    this._currentBlock = await this._getBlockNumber();
      this._socketClient.sendMessage(
      JSON.stringify({
          jsonrpc: '2.0',
          method: 'condenser_api.get_block',
          params: [this._currentBlock],
          id: 1,
          }))
      const processed = await this._processBlock(this._currentBlock)
      if (processed) await setTimeout(async () => this._loadNextBlock(), 1000);
      else await this._loadNextBlock();
  }

  private async _processBlock(blockNumber: number): Promise<boolean> {
      const cachedInfo = await this._processorClient.get(REDIS_KEY.BLOCK_TO_PARSE);
      if (!cachedInfo) return false;

      const block = JSON.parse(cachedInfo, null);
      if (!block) return false;


      if (block.transactions[0].block_num !== blockNumber) return false;

      if (block && (!block.transactions || !block.transactions[0])) {
      this._logger.log(`EMPTY BLOCK: ${blockNumber}`);
        await this._processorClient.set(
        this._redisBlockKey,
            `${this._currentBlock + 1}`,
      );

        return true;
    }


    if (block && block.transactions && block.transactions[0] && block.transactions[0].block_num === blockNumber) {
      const start = process.hrtime();
      await this._hiveParserDomain.parseHiveBlock(block);
            await this._processorClient.set(
        this._redisBlockKey,
        `${this._currentBlock + 1}`,
            );
      const end = process.hrtime(start);
        this._logger.log(`${this._currentBlock}: ${end[1] / 1000000}ms`);

        return true;
    }

    return false;
  }

  private async _getBlockNumber(): Promise<number> {
    const blockNumber = await this._processorClient.get(this._redisBlockKey);
    if (blockNumber) return +blockNumber;

    return this._startDefaultBlock;
  }
}
