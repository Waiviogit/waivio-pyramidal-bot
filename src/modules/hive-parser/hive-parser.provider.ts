import { Provider } from '@nestjs/common';
import { HIVE_PARSER_PROVIDERS } from '../../common/constants/providers';
import { HiveParserDomain } from './domains/hive-parser.domain';

export const HiveMainParserProvider: Provider = {
  provide: HIVE_PARSER_PROVIDERS.MAIN,
  useClass: HiveParserDomain,
};
