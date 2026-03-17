export interface IMeliBrandsRepository {
  getBrands(page: number, limit: number): Promise<string[]>;
}
