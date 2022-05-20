export const HIVE_RPC_NODES = [
  'https://api.openhive.network', // 30 - 70 = 50ms
  'https://hive-api.arcange.eu', // 40 - 100 = 70ms
  'https://hived.emre.sh', // Finland
  'https://api.pharesim.me', // Germany
  'https://api.deathwing.me', //Germany
  'https://blocks.waivio.com',
  'https://anyx.io', // 270 - 500 = 385ms
  'https://api.hive.blog', // 270 - 600 = 435ms
];

const HIVE_API = Object.freeze({
  CONDENSER_API: 'condenser_api',
});

export const CONDENSER_API = Object.freeze({
  GET_BLOCK: `${HIVE_API.CONDENSER_API}.get_block`,
});
