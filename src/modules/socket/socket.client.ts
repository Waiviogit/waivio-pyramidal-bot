import WebSocket from 'ws';
import { Inject, Injectable } from '@nestjs/common';
import { configService } from '../../common/services/config.service';
import { hiveBlockType } from '../hive-parser/types/hive-parser.types';
import { REDIS_PROVIDERS } from '../../common/constants/providers';
import { IBlockProcessor } from '../redis/interfaces/redis-client.interfaces';
import { REDIS_KEY } from '../redis/constants/redis.constants';

@Injectable()
export class SocketClient {
  private readonly _url = `${configService.getWSSUrl()}`;
  private _ws = new WebSocket(this._url);
  private _block: hiveBlockType;
  constructor(
    @Inject(REDIS_PROVIDERS.MAIN)
    private readonly _redisClient: IBlockProcessor,
  ) {
    this._ws.on('open', () => {
      console.info('socket connection open');
    });

    this._ws.on('error', () => {
      this._ws.close();
    });

    this._ws.on('message', (message) => {
      const response = JSON.parse(message);
      this._block = response.result;
    });
  }

  async sendMessage(message: string): Promise<void> {
    if (this._ws.readyState !== 1) {
      this._ws = new WebSocket(this._url);
      this._ws.on('error', () => {
        this._ws.close();
      });
      this._ws.on('message', (message) => {
        const response = JSON.parse(message);
        this._block = response.result;
      });

      return;
    }

    this._ws.send(message);
    this.setBlock();
  }

  async setBlock(): Promise<void> {
    if (this._block) {
      await this._redisClient.set(
          REDIS_KEY.BLOCK_TO_PARSE,
          JSON.stringify(this._block),
      );
    }
  }
}
