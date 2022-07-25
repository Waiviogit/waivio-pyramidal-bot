import WebSocket from 'ws';
import { Injectable } from '@nestjs/common';
import { configService } from '../../common/services/config.service';
import { hiveBlockType } from '../hive-parser/types/hive-parser.types';

@Injectable()
export class SocketClient {
  private readonly _url = `${configService.getWSSUrl()}`;
  private _ws = new WebSocket(this._url);
  private _block: hiveBlockType;
  constructor() {
        this._ws.on('open', () => {
      console.info('socket connection open');
        });

        this._ws.on('error', () => {
      this._ws.close();
        });
      this._ws.on('message', (message) => {
          const response = JSON.parse(message);
          this._block = response.result;
      })
    }

     async sendMessage(message: string): Promise<hiveBlockType> {
        if (this._ws.readyState !== 1) {
            this._ws = new WebSocket(this._url);
            this._ws.on('error', () => {
                this._ws.close();
            });
           this._ws.on('message', (message) => {
                 const response = JSON.parse(message);
                this._block = response.result;
            })

            return;
        }

         this._ws.send(message);

        return this._block;
    }
}
