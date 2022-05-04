import { Module } from '@nestjs/common';
import { HiveMainParserProvider } from './hive-parser.provider';
import { PyramidalBotModule } from '../pyramidal-bot/pyramidal-bot.module';

@Module({
  imports: [PyramidalBotModule],
  providers: [HiveMainParserProvider],
  exports: [HiveMainParserProvider],
})
export class HiveParserModule {}
