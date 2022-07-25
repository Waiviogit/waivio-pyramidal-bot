import { Module } from '@nestjs/common';
import { BlockProcessorService } from './services/block-processor.service';
import { HiveParserModule } from '../hive-parser/hive-parser.module';
import { BlockchainApiModule } from '../blockchain-api/blockchain-api.module';
import { SocketClientModule } from '../socket/socket.module';

@Module({
  imports: [HiveParserModule, BlockchainApiModule, SocketClientModule],
  providers: [BlockProcessorService],
})
export class BlockProcessorModule {}
