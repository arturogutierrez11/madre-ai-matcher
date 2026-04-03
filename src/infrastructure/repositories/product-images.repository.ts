import { Injectable, Logger } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  IProductImagesRepository,
  PersistedProductImage,
} from 'src/domains/interface/product-images.repository.interface';

@Injectable()
export class ProductImagesRepository implements IProductImagesRepository {
  private readonly logger = new Logger(ProductImagesRepository.name);
  private readonly processedProductsCachePath = join(
    process.cwd(),
    '.cache',
    'fravega-processed-products.json',
  );
  private processedProducts = new Set<string>();
  private cacheLoaded = false;
  private saveQueue = Promise.resolve();

  saveMany(images: PersistedProductImage[]): Promise<void> {
    if (!images.length) {
      return Promise.resolve();
    }

    this.logger.log(
      `Persistence hook not configured. Skipping save for ${images.length} processed images.`,
    );

    return Promise.resolve();
  }

  async hasProcessedProduct(sku: string, refId: string): Promise<boolean> {
    await this.ensureCacheLoaded();

    return this.processedProducts.has(
      this.buildProcessedProductKey(sku, refId),
    );
  }

  async markProductProcessed(sku: string, refId: string): Promise<void> {
    await this.ensureCacheLoaded();

    const key = this.buildProcessedProductKey(sku, refId);

    if (this.processedProducts.has(key)) {
      return;
    }

    this.processedProducts.add(key);

    this.saveQueue = this.saveQueue.then(async () => {
      await mkdir(dirname(this.processedProductsCachePath), {
        recursive: true,
      });
      await writeFile(
        this.processedProductsCachePath,
        JSON.stringify([...this.processedProducts].sort(), null, 2),
        'utf-8',
      );
    });

    await this.saveQueue;
  }

  private async ensureCacheLoaded(): Promise<void> {
    if (this.cacheLoaded) {
      return;
    }

    this.cacheLoaded = true;

    try {
      const content = await readFile(this.processedProductsCachePath, 'utf-8');
      const parsed = JSON.parse(content) as string[];

      if (Array.isArray(parsed)) {
        this.processedProducts = new Set(parsed.filter(Boolean));
      }

      this.logger.log(
        `Loaded ${this.processedProducts.size} processed products from cache`,
      );
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code !== 'ENOENT') {
        this.logger.warn(
          `Unable to load processed products cache: ${nodeError.message}`,
        );
      }
    }
  }

  private buildProcessedProductKey(sku: string, refId: string): string {
    return `${sku}::${refId}`;
  }
}
