export interface IMadreCategoryMatchRepository {
  exists(meliCategoryId: string): Promise<boolean>;

  save(match: {
    meliCategoryId: string;
    meliCategoryPath: string;
    megatoneCategoryId: string;
    megatoneCategoryPath: string;
  }): Promise<void>;

  saveBulk(
    matches: {
      meliCategoryId: string;
      meliCategoryPath: string;
      megatoneCategoryId: string;
      megatoneCategoryPath: string;
    }[],
  ): Promise<void>;
}
