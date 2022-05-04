export interface IConfigService {
  ensureValues(keys: string[]): IConfigService;
  getPort(): number;
  getCustomKey(key: string): string;
  getRedisConfig(): string;
}
