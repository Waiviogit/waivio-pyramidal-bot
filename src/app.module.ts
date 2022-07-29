import { Module } from '@nestjs/common';
import { RedisClientModule } from './modules/redis/redis.module';
import { HiveParserModule } from './modules/hive-parser/hive-parser.module';
import { BlockProcessorModule } from './modules/processor/block-processor.module';
import { BlockchainApiModule } from './modules/blockchain-api/blockchain-api.module';
import { PyramidalBotModule } from './modules/pyramidal-bot/pyramidal-bot.module';
import { SocketClientModule } from './modules/socket/socket.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    RedisClientModule,
    HiveParserModule,
    BlockProcessorModule,
    BlockchainApiModule,
    PyramidalBotModule,
    SocketClientModule,
    EventEmitterModule.forRoot(),
  ],
})
export class AppModule {}
