export interface IMeliCategoriesRepository {
  getCategoriesTree(): Promise<any[]>;
}
