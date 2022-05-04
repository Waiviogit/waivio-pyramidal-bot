import { Module } from '@nestjs/common';
import { BlockchainApiService } from './services/blockchain-api.service';

@Module({
  providers: [BlockchainApiService],
  exports: [BlockchainApiService],
})
export class BlockchainApiModule {}
