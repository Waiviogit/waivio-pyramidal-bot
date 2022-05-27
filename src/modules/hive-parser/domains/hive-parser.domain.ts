import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  hiveBlockType,
  hiveOperationDataType,
  triggerType,
} from '../types/hive-parser.types';
import { IHiveParserDomain } from '../interfaces/domains/hive-parser-domain.interface';
import {
  CUSTOM_JSON,
  OPERATION_DATA,
} from '../constants/hive-parser.constants';
import { PYRAMIDAL_BOTS } from '../../pyramidal-bot/constants/pyramidal-bot.constants';
import { PYRAMIDAL_BOT_PROVIDERS } from '../../../common/constants/providers';
import { IPyramidalBotDomain } from '../../pyramidal-bot/interfaces/domains/pyramidal-bot-domain.interface';
import { configService } from '../../../common/services/config.service';
import _ from 'lodash';

@Injectable()
export class HiveParserDomain implements IHiveParserDomain {
  private readonly _logger = new Logger(HiveParserDomain.name);
  constructor(
    @Inject(PYRAMIDAL_BOT_PROVIDERS.MAIN)
    private readonly _pyramidalBotDomain: IPyramidalBotDomain,
  ) {}

  async parseHiveBlock(block: hiveBlockType): Promise<void> {
    try {
      const { transactions } = block;

      const triggers: triggerType[] = [];
      for (const transaction of transactions) {
        if (!transaction?.operations && !transaction.operations[0]) continue;

        for (const operation of transaction.operations) {
          const [operationType, operationData] = operation;
          const isCustomJson =
            operationType.includes(CUSTOM_JSON) &&
            operationData.hasOwnProperty(OPERATION_DATA.id);
          if (!isCustomJson) continue;

          const isHiveEngineOperation =
            operationData.id &&
            operationData.id.includes(OPERATION_DATA.hive_engine);
          if (!isHiveEngineOperation) continue;

          this._parseJson(
            operationData as unknown as hiveOperationDataType,
            triggers,
          );
        }
      }
      if (!triggers.length) return;

      const ourTransactions = triggers.filter(
        (trigger) =>
          trigger.required_auths ===
          configService.getCustomKey('TRI_BOT_ACCOUNT'),
      );
      if (ourTransactions.length === triggers.length) return;

      await this._pyramidalBotDomain.startPyramidalBot(
        triggers,
        transactions[0].block_num,
      );
    } catch (error) {
      this._logger.error(error.message);
    }
  }

  /** --------------------------PRIVATE METHODS----------------------------------------*/

  private _parseJson(
    operation: hiveOperationDataType,
    triggers: triggerType[],
  ): void {
    const parsedJson = JSON.parse(operation.json);
    if (!parsedJson || !parsedJson.length) return;

    for (const json of parsedJson) {
      [json.required_auths] = operation.required_auths;
    }

    const swaps = parsedJson.filter(
      (el) =>
        el.contractName.includes(OPERATION_DATA.contract_name) &&
        el.contractAction.includes(OPERATION_DATA.contract_action) &&
        _.some(
          _.flatten(_.map(PYRAMIDAL_BOTS, 'tokenPairs')),
          (pool) => pool === el.contractPayload.tokenPair,
        ),
    );
    if (swaps.length) triggers.push(...swaps);
  }
}
