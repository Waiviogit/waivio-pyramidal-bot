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
import { OnEvent } from '@nestjs/event-emitter';
import { hiveBlockType } from '../../hive-parser/types/hive-parser.types';

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
    await this._loadNextBlock();
  }

  /** --------------------------PRIVATE METHODS----------------------------------------*/

  @OnEvent('load')
  private async _loadNextBlock(): Promise<void> {
    this._currentBlock = await this._getBlockNumber();
    setTimeout(
      () =>
        this._socketClient.sendMessage(
          JSON.stringify({
            jsonrpc: '2.0',
            method: 'condenser_api.get_block',
            params: [this._currentBlock],
            id: 1,
          }),
        ),
      1000,
    );
  }

  @OnEvent('process')
  private async _processBlock(block: hiveBlockType): Promise<void> {
    if (block && (!block.transactions || !block.transactions[0])) {
      this._logger.log(`EMPTY BLOCK: ${this._currentBlock}`);
      await this._processorClient.set(
        this._redisBlockKey,
        `${this._currentBlock + 1}`,
      );
    }

    if (block && block.transactions && block.transactions[0]) {
      const start = process.hrtime();
      await this._hiveParserDomain.parseHiveBlock(block);
      await this._processorClient.set(
        this._redisBlockKey,
        `${this._currentBlock + 1}`,
      );
      const end = process.hrtime(start);
      this._logger.log(
        `${block.transactions[0].block_num}: ${end[1] / 1000000}ms`,
      );
    }

    await this._loadNextBlock();
  }

  private async _getBlockNumber(): Promise<number> {
    const blockNumber = await this._processorClient.get(this._redisBlockKey);
    if (blockNumber) return +blockNumber;

    return this._startDefaultBlock;
  }
}
