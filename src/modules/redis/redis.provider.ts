import { Provider } from '@nestjs/common';
import { REDIS_PROVIDERS } from '../../common/constants/providers';
import { RedisClient } from './clients/redis.client';

export const RedisProvider: Provider = {
  provide: REDIS_PROVIDERS.MAIN,
  useClass: RedisClient,
};
