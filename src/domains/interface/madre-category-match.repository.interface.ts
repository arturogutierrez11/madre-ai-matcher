export interface IMadreCategoryMatchRepository {
  getAll(page?: number, limit?: number): Promise<any[]>;

  findByMeliCategoryId(meliCategoryId: string): Promise<any | null>;

  exists(meliCategoryId: string): Promise<boolean>;

  save(match: {
    meliCategoryId: string;
    meliCategoryPath: string;
    fravegaCategoryId: string;
    fravegaCategoryPath: string;
  }): Promise<void>;

  saveBulk(
    matches: {
      meliCategoryId: string;
      meliCategoryPath: string;
      fravegaCategoryId: string;
      fravegaCategoryPath: string;
    }[],
  ): Promise<void>;
}
