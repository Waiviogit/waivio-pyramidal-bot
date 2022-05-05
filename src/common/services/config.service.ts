import dotenv from 'dotenv';
import { IConfigService } from '../interfaces/config-service.interface';

dotenv.config({ path: `env/${process.env.NODE_ENV || 'development'}.env` });

class ConfigService implements IConfigService {
  constructor(private env: { [k: string]: string | undefined }) {}

  ensureValues(keys: string[]): IConfigService {
    keys.forEach((k) => this._getValue(k, true));

    return this;
  }

  getPort(): number {
    return +this._getValue('PORT', true);
  }

  getCustomKey(key: string): string {
    return this._getValue(key, true);
  }

  getRedisConfig(): string {
    const host = this._getValue('REDIS_HOST');
    const port = this._getValue('REDIS_PORT');
    const db = this._getValue('REDIS_DB');

    return `redis://${host}:${port}/${db}`;
  }

  /** --------------------------PRIVATE METHODS----------------------------------------*/

  private _getValue(key: string, throwOnMissing = true): string {
    const value = this.env[key] as string;
    if (!value && throwOnMissing) {
      throw new Error(`config error. config error - missing env.${key}`);
    }

    return value;
  }
}

const configService = new ConfigService(process.env);

export { configService };
