import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configService } from './common/services/config.service';
import { BlockProcessorService } from './modules/processor/services/block-processor.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const blockProcessor = app.get(BlockProcessorService);

  await app.listen(configService.getPort());
  await blockProcessor.start();
}
bootstrap();
