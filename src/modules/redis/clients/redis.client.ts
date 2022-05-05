import { Logger, OnModuleInit } from '@nestjs/common';
import { createClient } from 'redis';
import {
  addMemberToZsetType,
  deleteZsetMembersType,
} from '../types/redis.types';
import {
  IBlockProcessor,
  IPyramidalBot,
} from '../interfaces/redis-client.interfaces';
import { configService } from '../../../common/services/config.service';

export class RedisClient
  implements OnModuleInit, IBlockProcessor, IPyramidalBot
{
  private _client;
  private readonly _logger = new Logger(RedisClient.name);
  constructor() {
    this._client = createClient({ url: configService.getRedisConfig() });
    this._client.on('error', (err) => console.log('Redis Client Error', err));
  }

  async onModuleInit(): Promise<void> {
    try {
      await this._client.connect();
    } catch (error) {
      this._logger.error(error.message);
    }
  }

  async zadd({ key, value, score }: addMemberToZsetType): Promise<void> {
    try {
      await this._client.zAdd(key, { value, score });
    } catch (error) {
      this._logger.error(error.message);
    }
  }

  async zremrangebyscore({
    key,
    min,
    max,
  }: deleteZsetMembersType): Promise<void> {
    try {
      await this._client.zRemRangeByScore(key, min, max);
    } catch (error) {
      this._logger.error(error.message);
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this._client.expire(key, seconds);
    } catch (error) {
      this._logger.error(error.message);
    }
  }

  async hset(key: string, data: object): Promise<void> {
    try {
      for (const [field, value] of Object.entries(data)) {
        await this._client.hSet(key, field, value);
      }
    } catch (error) {
      this._logger.error(error.message);
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await this._client.set(key, value);
    } catch (error) {
      this._logger.error(error.message);
    }
  }

  async get(key: string): Promise<string | undefined> {
    try {
      return this._client.get(key);
    } catch (error) {
      this._logger.error(error.message);
    }
  }
}
