import { Module } from '@nestjs/common';
import { RedisClientModule } from './modules/redis/redis.module';
import { HiveParserModule } from './modules/hive-parser/hive-parser.module';
import { BlockProcessorModule } from './modules/processor/block-processor.module';
import { BlockchainApiModule } from './modules/blockchain-api/blockchain-api.module';
import { PyramidalBotModule } from './modules/pyramidal-bot/pyramidal-bot.module';

@Module({
  imports: [
    RedisClientModule,
    HiveParserModule,
    BlockProcessorModule,
    BlockchainApiModule,
    PyramidalBotModule,
  ],
})
export class AppModule {}
