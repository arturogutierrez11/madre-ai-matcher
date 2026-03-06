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
    console.log('==============================');
    console.log('Starting Fravega Matcher');
    console.log('==============================');

    const categoriesTree = await this.categoriesRepository.getCategoriesTree();

    console.log(`Categories loaded: ${categoriesTree.length}`);

    while (true) {
      console.log(`Fetching products from Madre offset ${offset}`);

      const products = await this.madreRepository.getProducts(offset, limit);

      if (!products || products.length === 0) {
        console.log('No more products. Matcher finished.');
        break;
      }

      console.log(`Products fetched: ${products.length}`);

      for (const product of products) {
        try {
          console.log(
            `Processing SKU: ${product.sku} | ML Category: ${product.meliCategoryPath}`,
          );

          const exists = await this.categoryMatchRepository.exists(product.sku);

          if (exists) {
            console.log(`SKU ${product.sku} already matched`);
            continue;
          }

          const match = await this.retry(() =>
            this.openAIRepository.matchCategory(product, categoriesTree),
          );

          await this.categoryMatchRepository.save({
            sku: product.sku,
            categoryId: match.categoryId,
            categoryName: match.categoryName,
            categoryPath: match.categoryPath,
          });

          console.log(`Saved match for ${product.sku}`);

          await this.sleep(300);
        } catch (error) {
          console.error(`Error processing SKU ${product.sku}`);
          console.error(error);
        }
      }

      offset += limit;
    }

    console.log('==============================');
    console.log('Matcher Completed');
    console.log('==============================');

    return {
      message: 'Matcher finished',
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
        console.error('Retry failed completely');
        throw error;
      }

      console.log(`Retrying... attempts left ${retries}`);

      await new Promise((res) => setTimeout(res, delay));

      return this.retry(fn, retries - 1, delay * 2);
    }
  }
}
