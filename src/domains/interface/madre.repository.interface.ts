import { Product } from '../entities/product.entity';

export interface IMadreRepository {
  getProducts(offset: number, limit: number): Promise<Product[]>;
}
