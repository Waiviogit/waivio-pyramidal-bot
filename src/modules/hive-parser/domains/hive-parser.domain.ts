import { Inject, Injectable } from '@nestjs/common';
import {
  hiveBlockType,
  hiveOperationDataType,
  triggerType,
} from '../types/hive-parser.types';
import { IHiveParserDomain } from '../interfaces/domains/hive-parser-domain.interface';
import _ from 'lodash';
import {
  CUSTOM_JSON,
  OPERATION_DATA,
} from '../constants/hive-parser.constants';
import { PYRAMIDAL_BOTS } from '../../pyramidal-bot/constants/pyramidal-bot.constants';
import { PYRAMIDAL_BOT_PROVIDERS } from '../../../common/constants/providers';
import { IPyramidalBotDomain } from '../../pyramidal-bot/interfaces/domains/pyramidal-bot-domain.interface';
import { configService } from '../../../common/services/config.service';

@Injectable()
export class HiveParserDomain implements IHiveParserDomain {
  constructor(
    @Inject(PYRAMIDAL_BOT_PROVIDERS.MAIN)
    private readonly _pyramidalBotDomain: IPyramidalBotDomain,
  ) {}

  async parseHiveBlock(block: hiveBlockType): Promise<void> {
    const { transactions } = block;

    const triggers: triggerType[] = [];
    for (const transaction of transactions) {
      if (!transaction?.operations && !transaction.operations[0]) continue;

      for (const operation of transaction.operations) {
        const [operationType, operationData] = operation;
        const isCustomJson =
          _.includes(operationType, CUSTOM_JSON) &&
          operationData.hasOwnProperty(OPERATION_DATA.id);
        if (!isCustomJson) continue;

        const operationDataId = _.get(operationData, OPERATION_DATA.id);
        const isHiveEngineOperation =
          operationDataId &&
          _.includes(operationDataId, OPERATION_DATA.hive_engine);
        if (!isHiveEngineOperation) continue;

        this._parseJson(
          operationData as unknown as hiveOperationDataType,
          triggers,
        );
      }
    }
    if (!triggers.length) return;

    await this._pyramidalBotDomain.startPyramidalBot(
      triggers,
      transactions[0].block_num,
    );
  }

  /** --------------------------PRIVATE METHODS----------------------------------------*/

  private _parseJson(
    operation: hiveOperationDataType,
    triggers: triggerType[],
  ): void {
    const isOurTransaction = _.includes(
      _.get(operation, 'required_auths'),
      configService.getCustomKey('TRI_BOT_ACCOUNT'),
    );
    if (isOurTransaction) return;

    const parsedJson = JSON.parse(operation.json);
    if (!parsedJson || !parsedJson.length) return;

    const swaps = _.filter(
      parsedJson,
      (el) =>
        _.includes(el.contractName, OPERATION_DATA.contract_name) &&
        _.includes(el.contractAction, OPERATION_DATA.contract_action) &&
        _.some(
          _.flatten(_.map(PYRAMIDAL_BOTS, 'tokenPairs')),
          (pool) => pool === el.contractPayload.tokenPair,
        ),
    );
    if (swaps.length) triggers.push(...swaps);
  }
}
