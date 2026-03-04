export interface ICategoryMatchRepository {
  exists(sku: string): Promise<boolean>;

  save(match: {
    sku: string;
    categoryId: string;
    categoryName: string;
    categoryPath: string;
  }): Promise<void>;
}
