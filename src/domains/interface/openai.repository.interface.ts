import { Product } from '../entities/product.entity';

export interface CategoryMatchResult {
  categoryId: string;
  categoryName: string;
  categoryPath: string;
}

export interface IOpenAIRepository {
  matchCategory(
    product: Product,
    categories: any[],
  ): Promise<CategoryMatchResult>;

  matchBrand(
    meliBrand: string,
    fravegaBrands: { id: string; name: string }[],
  ): Promise<{
    fravegaBrandId: string | null;
    fravegaBrandName: string | null;
    confidence: number;
  }>;
}
