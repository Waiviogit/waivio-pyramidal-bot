import { Module } from '@nestjs/common';
import { PyramidalBotProvider } from './pyramidal-bot.provider';
import { BlockchainApiModule } from '../blockchain-api/blockchain-api.module';
import { SwapOutputService } from './services/swap-output.service';

@Module({
  imports: [BlockchainApiModule],
  providers: [PyramidalBotProvider, SwapOutputService],
  exports: [PyramidalBotProvider],
})
export class PyramidalBotModule {}
