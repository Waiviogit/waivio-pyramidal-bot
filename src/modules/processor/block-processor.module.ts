import { Module } from '@nestjs/common';
import { BlockProcessorService } from './services/block-processor.service';
import { HiveParserModule } from '../hive-parser/hive-parser.module';
import { BlockchainApiModule } from '../blockchain-api/blockchain-api.module';

@Module({
  imports: [HiveParserModule, BlockchainApiModule],
  providers: [BlockProcessorService],
})
export class BlockProcessorModule {}
