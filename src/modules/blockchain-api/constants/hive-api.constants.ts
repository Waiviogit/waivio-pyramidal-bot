export const HIVE_RPC_NODES = [
  'https://api.openhive.network', // 30 - 70 = 50ms
  'https://rpc.ecency.com', // 30 - 80 = 55ms
  'https://hive-api.arcange.eu', // 40 - 100 = 70ms
  'https://rpc.ausbit.dev', // 90 - 180 = 135ms
  'https://anyx.io', // 270 - 500 = 385ms
  'https://api.hive.blog', // 270 - 600 = 435ms
];

const HIVE_API = Object.freeze({
  CONDENSER_API: 'condenser_api',
});

export const CONDENSER_API = Object.freeze({
  GET_BLOCK: `${HIVE_API.CONDENSER_API}.get_block`,
});
