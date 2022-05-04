import { Provider } from '@nestjs/common';
import { PyramidalBotDomain } from './domains/pyramidal-bot.domain';
import { PYRAMIDAL_BOT_PROVIDERS } from '../../common/constants/providers';

export const PyramidalBotProvider: Provider = {
  provide: PYRAMIDAL_BOT_PROVIDERS.MAIN,
  useClass: PyramidalBotDomain,
};
