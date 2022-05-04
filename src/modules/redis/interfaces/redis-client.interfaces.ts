import {
  addMemberToZsetType,
  deleteZsetMembersType,
} from '../types/redis.types';

export interface IPyramidalBot {
  zadd(data: addMemberToZsetType): Promise<void>;
  zremrangebyscore(data: deleteZsetMembersType): Promise<void>;
  expire(key: string, seconds: number): Promise<void>;
  hset(key: string, data: object): Promise<void>;
}

export interface IBlockProcessor {
  get(key: string): Promise<string>;
  set(key: string, value: string): Promise<void>;
}
