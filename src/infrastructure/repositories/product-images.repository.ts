import { Injectable, Logger } from '@nestjs/common';
import {
  IProductImagesRepository,
  PersistedProductImage,
} from 'src/domains/interface/product-images.repository.interface';

@Injectable()
export class ProductImagesRepository implements IProductImagesRepository {
  private readonly logger = new Logger(ProductImagesRepository.name);

  saveMany(images: PersistedProductImage[]): Promise<void> {
    if (!images.length) {
      return Promise.resolve();
    }

    this.logger.log(
      `Persistence hook not configured. Skipping save for ${images.length} processed images.`,
    );

    return Promise.resolve();
  }
}
