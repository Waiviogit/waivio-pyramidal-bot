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
  ) {}

  async start(): Promise<void> {
    console.log('started!');
    await this._loadNextBlock();
  }

  /** --------------------------PRIVATE METHODS----------------------------------------*/

  private async _loadNextBlock(): Promise<void> {
    this._currentBlock = await this._getBlockNumber();
    const start = process.hrtime();
    const processed = await this._processBlock(this._currentBlock);
    const end = process.hrtime(start);

    this._logger.log(`${this._currentBlock}: ${end[1] / 1000000}ms`);
    // if (processed) {
    //   await this._processorClient.set(
    //     this._redisBlockKey,
    //     `${this._currentBlock + 1}`,
    //   );
    await this._loadNextBlock();
    // } else {
    //   await setTimeout(async () => this._loadNextBlock(), 2000);
    // }
  }

  private async _processBlock(blockNumber: number): Promise<boolean> {
    const block = await this._hiveApiDomain.getBlock(blockNumber);
    if (block && (!block.transactions || !block.transactions[0])) {
      this._logger.log(`EMPTY BLOCK: ${blockNumber}`);

      return true;
    }
    if (block && block.transactions && block.transactions[0]) {
      await this._hiveParserDomain.parseHiveBlock(block);

      return true;
    }

    return false;
  }

  private async _getBlockNumber(): Promise<number> {
    const blockNumber = await this._processorClient.get(this._redisBlockKey);
    console.log('blockNumber', blockNumber);
    if (blockNumber) return +blockNumber;

    return this._startDefaultBlock;
  }
}
