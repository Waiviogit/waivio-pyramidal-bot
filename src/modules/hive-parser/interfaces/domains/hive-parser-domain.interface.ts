import { hiveBlockType } from '../../types/hive-parser.types';

export interface IHiveParserDomain {
  parseHiveBlock(block: hiveBlockType): void;
}
