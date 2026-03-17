import NodeCache from 'node-cache';

export const brandsCache = new NodeCache({
  stdTTL: 3600, // 1 hora
});
