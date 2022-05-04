import { triggerType } from '../../../hive-parser/types/hive-parser.types';

export interface IPyramidalBotDomain {
  startPyramidalBot(
    triggers: triggerType[],
    blockNumber: number,
  ): Promise<void>;
}
