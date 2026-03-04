export interface ICategoriesRepository {
  getCategoriesTree(): Promise<any[]>;
}
