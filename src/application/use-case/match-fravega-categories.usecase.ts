import { Inject, Injectable } from '@nestjs/common';
import type { ICategoriesRepository } from 'src/domains/interface/categories.repository.interface';
import type { ICategoryMatchRepository } from 'src/domains/interface/category-match.repository.interface';
import type { IMadreRepository } from 'src/domains/interface/madre.repository.interface';
import type { IOpenAIRepository } from 'src/domains/interface/openai.repository.interface';

@Injectable()
export class MatchFravegaCategoriesUseCase {
  constructor(
    @Inject('IMadreRepository')
    private readonly madreRepository: IMadreRepository,

    @Inject('ICategoriesRepository')
    private readonly categoriesRepository: ICategoriesRepository,

    @Inject('IOpenAIRepository')
    private readonly openAIRepository: IOpenAIRepository,

    @Inject('ICategoryMatchRepository')
    private readonly categoryMatchRepository: ICategoryMatchRepository,
  ) {}

  async execute(offset = 0, limit = 50) {
    console.log('Fetching products from Madre...');

    const products = await this.madreRepository.getProducts(offset, limit);

    console.log(`Products fetched: ${products.length}`);

    const categoriesTree = await this.categoriesRepository.getCategoriesTree();

    console.log('Categories loaded');

    for (const product of products) {
      console.log(`Processing SKU: ${product.sku}`);

      const exists = await this.categoryMatchRepository.exists(product.sku);

      if (exists) {
        console.log(`SKU ${product.sku} already matched`);
        continue;
      }

      const match = await this.openAIRepository.matchCategory(
        product,
        categoriesTree,
      );

      await this.categoryMatchRepository.save({
        sku: product.sku,
        categoryId: match.categoryId,
        categoryName: match.categoryName,
        categoryPath: match.categoryPath,
      });

      await this.sleep(300); // evita saturar OpenAI
    }

    return {
      processed: products.length,
    };
  }
  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async retry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries === 0) {
        throw error;
      }

      console.log(`Retrying... attempts left ${retries}`);

      await new Promise((res) => setTimeout(res, delay));

      return this.retry(fn, retries - 1, delay * 2);
    }
  }
}
