import NodeCache from 'node-cache';

export const categoriesCache = new NodeCache({
  stdTTL: 3600,
});
