import { Inject, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  FravegaPublishedProductItem,
  FravegaPublishedProductsRepository,
} from 'src/infrastructure/repositories/fravega-published-products.repository';
import {
  MadreProductImage,
  MadreProductsRepository,
} from 'src/infrastructure/repositories/madre-products.repository';
import {
  FravegaImagesRepository,
  FravegaUpdateImagePayload,
  FravegaUpdateProductPayload,
} from 'src/infrastructure/repositories/fravega-images.repository';
import { ImageProcessorService } from 'src/infrastructure/services/image-processor.service';
import { SpacesService } from 'src/infrastructure/services/spaces.service';
import { FravegaImagesSyncConfigService } from 'src/infrastructure/services/fravega-images-sync-config.service';
import type { IProductImagesRepository } from 'src/domains/interface/product-images.repository.interface';
import { PersistedProductImage } from 'src/domains/interface/product-images.repository.interface';

export interface SyncFravegaProductImagesInput {
  offset?: number;
  limit?: number;
  refIds?: string[];
  dryRun?: boolean;
}

export interface SyncAllFravegaProductImagesInput {
  startOffset?: number;
  limit?: number;
  dryRun?: boolean;
  maxBatches?: number;
}

interface ProductSyncSuccess {
  refId: string;
  fravegaSku: string;
  updated: boolean;
  imageCount: number;
  payload: FravegaUpdateProductPayload;
}

interface ProductSyncFailure {
  refId?: string;
  fravegaSku?: string;
  error: string;
}

interface EnsuredProductImage {
  cdnUrl: string;
  reusedExistingImage: boolean;
}

interface PreparedProductImage {
  payloadImage: FravegaUpdateImagePayload;
  persistedImage: PersistedProductImage;
}

export interface SyncFravegaProductImagesResult {
  totalRequested: number;
  processed: number;
  patched: number;
  skipped: number;
  failed: number;
  products: ProductSyncSuccess[];
  failures: ProductSyncFailure[];
}

export interface SyncAllFravegaProductImagesResult {
  startedAtOffset: number;
  nextOffset: number;
  limit: number;
  batches: number;
  totalRequested: number;
  processed: number;
  patched: number;
  skipped: number;
  failed: number;
  completed: boolean;
  batchResults: Array<{
    batch: number;
    offset: number;
    totalRequested: number;
    processed: number;
    patched: number;
    skipped: number;
    failed: number;
  }>;
  failures: ProductSyncFailure[];
}

@Injectable()
export class SyncFravegaProductImagesUseCase {
  private readonly logger = new Logger(SyncFravegaProductImagesUseCase.name);

  constructor(
    private readonly fravegaPublishedProductsRepository: FravegaPublishedProductsRepository,
    private readonly madreProductsRepository: MadreProductsRepository,
    private readonly fravegaImagesRepository: FravegaImagesRepository,
    private readonly imageProcessorService: ImageProcessorService,
    private readonly spacesService: SpacesService,
    private readonly httpService: HttpService,
    private readonly configService: FravegaImagesSyncConfigService,
    @Inject('IProductImagesRepository')
    private readonly productImagesRepository: IProductImagesRepository,
  ) {}

  async execute(
    input: SyncFravegaProductImagesInput,
  ): Promise<SyncFravegaProductImagesResult> {
    const offset = input.offset ?? 0;
    const limit = input.limit ?? 100;
    const dryRun = input.dryRun ?? false;

    const publishedProducts =
      await this.fravegaPublishedProductsRepository.getPublishedProducts({
        offset,
        limit,
        refIds: input.refIds,
      });

    const products = this.filterValidProducts(publishedProducts);
    const successes: ProductSyncSuccess[] = [];
    const failures: ProductSyncFailure[] = [];
    let skipped = 0;

    await this.processInBatches(products, async (product) => {
      try {
        const result = await this.processSingleProduct({
          product,
          dryRun,
        });

        if (result === null) {
          skipped += 1;
          return;
        }

        successes.push(result);
      } catch (error) {
        const message = this.formatError(error);

        failures.push({
          refId: product.refId,
          fravegaSku: product.sku,
          error: message,
        });

        this.logger.error(
          `Failed syncing images for refId ${product.refId}: ${message}`,
        );
      }
    });

    return {
      totalRequested: products.length,
      processed: successes.length + failures.length,
      patched: successes.filter((product) => product.updated).length,
      skipped,
      failed: failures.length,
      products: successes,
      failures,
    };
  }

  async executeAll(
    input: SyncAllFravegaProductImagesInput,
  ): Promise<SyncAllFravegaProductImagesResult> {
    const startedAtOffset = input.startOffset ?? 0;
    const limit = input.limit ?? 100;
    const dryRun = input.dryRun ?? false;
    const maxBatches = input.maxBatches;

    let currentOffset = startedAtOffset;
    let batches = 0;
    let totalRequested = 0;
    let processed = 0;
    let patched = 0;
    let skipped = 0;
    let failed = 0;
    let completed = true;

    const batchResults: SyncAllFravegaProductImagesResult['batchResults'] = [];
    const failures: ProductSyncFailure[] = [];

    while (true) {
      if (maxBatches && batches >= maxBatches) {
        completed = false;
        break;
      }

      this.logger.log(
        `Starting Fravega images batch ${batches + 1} offset=${currentOffset} limit=${limit} dryRun=${dryRun}`,
      );

      const batchResult = await this.execute({
        offset: currentOffset,
        limit,
        dryRun,
      });

      batches += 1;
      totalRequested += batchResult.totalRequested;
      processed += batchResult.processed;
      patched += batchResult.patched;
      skipped += batchResult.skipped;
      failed += batchResult.failed;
      failures.push(...batchResult.failures);

      batchResults.push({
        batch: batches,
        offset: currentOffset,
        totalRequested: batchResult.totalRequested,
        processed: batchResult.processed,
        patched: batchResult.patched,
        skipped: batchResult.skipped,
        failed: batchResult.failed,
      });

      if (batchResult.totalRequested === 0) {
        break;
      }

      currentOffset += limit;
    }

    return {
      startedAtOffset,
      nextOffset: currentOffset,
      limit,
      batches,
      totalRequested,
      processed,
      patched,
      skipped,
      failed,
      completed,
      batchResults,
      failures,
    };
  }

  private async processSingleProduct(input: {
    product: FravegaPublishedProductItem;
    dryRun: boolean;
  }): Promise<ProductSyncSuccess | null> {
    if (this.productAlreadyHasImages(input.product)) {
      this.logger.log(
        `Skipping refId ${input.product.refId} because it already has images in Fravega`,
      );

      return null;
    }

    this.logger.log(
      `Loading madre-api images for refId ${input.product.refId}`,
    );

    const madreProduct = await this.madreProductsRepository.getProductBySku(
      input.product.refId,
    );

    if (!madreProduct?.images?.length) {
      throw new Error('Product has no source images in madre-api');
    }

    const images = this.selectProcessableImages(madreProduct.images);

    if (!images.length) {
      throw new Error('Product images are empty after filtering invalid URLs');
    }

    const preparedImages = await this.mapInBatches(
      images,
      async (image) =>
        this.prepareProductImage(input.product.refId, image, input.dryRun),
      this.configService.perProductImageConcurrency,
    );

    const sortedPreparedImages = preparedImages.sort(
      (left, right) =>
        Number(left.payloadImage.Id) - Number(right.payloadImage.Id),
    );

    const payloadImages = sortedPreparedImages.map(
      (image) => image.payloadImage,
    );
    const persistedImages = sortedPreparedImages.map(
      (image) => image.persistedImage,
    );

    await this.productImagesRepository.saveMany(persistedImages);

    const payload = this.buildFravegaUpdatePayload(
      input.product,
      payloadImages,
    );

    const shouldPatch =
      !input.dryRun &&
      this.configService.patchEnabled &&
      payload.images.length > 0;

    if (shouldPatch) {
      this.logger.log(`Updating Fravega product ${input.product.refId}`);

      await this.fravegaImagesRepository.updateProductByRefId(
        input.product.refId,
        payload,
      );
    }

    return {
      refId: input.product.refId,
      fravegaSku: input.product.sku,
      updated: shouldPatch,
      imageCount: payload.images.length,
      payload,
    };
  }

  private async ensureProductImage(input: {
    sku: string;
    image: MadreProductImage;
    dryRun: boolean;
  }): Promise<EnsuredProductImage> {
    const existingCdnUrl = await this.resolveExistingProductImageUrl({
      sku: input.sku,
      position: input.image.position,
      dryRun: input.dryRun,
    });

    if (existingCdnUrl) {
      return {
        cdnUrl: existingCdnUrl,
        reusedExistingImage: true,
      };
    }

    const originalImage = await this.downloadOriginalImage(input.image.url);

    const processedImage =
      await this.imageProcessorService.normalizeToFravegaJpg(originalImage);

    if (input.dryRun || !this.configService.uploadEnabled) {
      return {
        cdnUrl: this.spacesService.buildProductImageUrl(
          input.sku,
          input.image.position,
        ),
        reusedExistingImage: false,
      };
    }

    return {
      cdnUrl: await this.spacesService.uploadProductImage(
        input.sku,
        input.image.position,
        processedImage,
      ),
      reusedExistingImage: false,
    };
  }

  private async prepareProductImage(
    sku: string,
    image: MadreProductImage,
    dryRun: boolean,
  ): Promise<PreparedProductImage> {
    this.logger.log(`Processing image ${image.position} for refId ${sku}`);

    const ensuredImage = await this.ensureProductImage({
      sku,
      image,
      dryRun,
    });

    return {
      payloadImage: {
        Type: 'url',
        Id: String(image.position),
        Url: ensuredImage.cdnUrl,
      },
      persistedImage: {
        sku,
        marketplace: 'fravega',
        originalUrl: image.url,
        cdnUrl: ensuredImage.cdnUrl,
        position: image.position,
        isMain: image.position === 1,
        status: ensuredImage.reusedExistingImage ? 'skipped' : 'processed',
      },
    };
  }

  private async resolveExistingProductImageUrl(input: {
    sku: string;
    position: number;
    dryRun: boolean;
  }): Promise<string | null> {
    const cdnUrl = this.spacesService.buildProductImageUrl(
      input.sku,
      input.position,
    );

    if (input.dryRun) {
      return cdnUrl;
    }

    if (!this.configService.skipExistingUploads) {
      return null;
    }

    if (
      await this.spacesService.productImageExists(input.sku, input.position)
    ) {
      this.logger.log(
        `Reusing existing Spaces image for sku=${input.sku} position=${input.position}`,
      );

      return cdnUrl;
    }

    if (await this.cdnImageExists(cdnUrl)) {
      this.logger.log(
        `Reusing existing CDN image for sku=${input.sku} position=${input.position}`,
      );

      return cdnUrl;
    }

    return null;
  }

  private async cdnImageExists(url: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.head(url, {
          timeout: this.configService.requestTimeoutMs,
          validateStatus: () => true,
        }),
      );

      return response.status >= 200 && response.status < 400;
    } catch (error) {
      const message = this.formatError(error);

      this.logger.warn(`Unable to validate CDN image ${url}: ${message}`);

      return false;
    }
  }

  private async downloadOriginalImage(url: string): Promise<Buffer> {
    const response = await firstValueFrom(
      this.httpService.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: this.configService.requestTimeoutMs,
      }),
    );

    return Buffer.from(response.data);
  }

  private selectProcessableImages(
    images: MadreProductImage[],
  ): MadreProductImage[] {
    return images
      .filter((image) => typeof image.url === 'string' && image.url.length > 0)
      .sort((left, right) => left.position - right.position)
      .slice(0, this.configService.maxImagesPerProduct);
  }

  private filterValidProducts(products: FravegaPublishedProductItem[]) {
    return products.filter(
      (product): product is FravegaPublishedProductItem =>
        Boolean(product.refId) && Boolean(product.sku),
    );
  }

  private productAlreadyHasImages(
    product: FravegaPublishedProductItem,
  ): boolean {
    return Boolean(
      product.images?.some(
        (image) => typeof image.Url === 'string' && image.Url.length > 0,
      ),
    );
  }

  private buildFravegaUpdatePayload(
    product: FravegaPublishedProductItem,
    images: FravegaUpdateImagePayload[],
  ): FravegaUpdateProductPayload {
    return {
      ean: product.ean,
      origin: product.origin,
      active: product.active,
      title: product.title,
      subTitle: product.subTitle,
      brandId: product.brandId,
      countryId: product.countryId,
      refId: product.refId,
      primaryCategoryId: product.primaryCategoryId,
      description: product.description,
      video: product.video,
      dimensions: product.dimensions,
      images,
    };
  }

  private async processInBatches<T>(
    items: T[],
    handler: (item: T) => Promise<void>,
  ): Promise<void> {
    const concurrency = Math.max(1, this.configService.batchConcurrency);
    let index = 0;

    const workers = Array.from(
      { length: Math.min(concurrency, items.length) },
      async () => {
        while (index < items.length) {
          const currentIndex = index;

          index += 1;

          await handler(items[currentIndex]);
        }
      },
    );

    await Promise.all(workers);
  }

  private async mapInBatches<T, TResult>(
    items: T[],
    mapper: (item: T) => Promise<TResult>,
    concurrency: number,
  ): Promise<TResult[]> {
    const results = new Array<TResult>(items.length);

    await this.processInBatchesWithConcurrency(
      items,
      async (item, index) => {
        results[index] = await mapper(item);
      },
      concurrency,
    );

    return results;
  }

  private async processInBatchesWithConcurrency<T>(
    items: T[],
    handler: (item: T, index: number) => Promise<void>,
    concurrency: number,
  ): Promise<void> {
    const normalizedConcurrency = Math.max(1, concurrency);
    let index = 0;

    const workers = Array.from(
      { length: Math.min(normalizedConcurrency, items.length) },
      async () => {
        while (index < items.length) {
          const currentIndex = index;

          index += 1;

          await handler(items[currentIndex], currentIndex);
        }
      },
    );

    await Promise.all(workers);
  }

  private formatError(error: unknown): string {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const method = error.config?.method?.toUpperCase();
      const url = error.config?.url;
      const responseData = this.safeSerialize(error.response?.data);

      return [method, url, status ? `status=${status}` : null, responseData]
        .filter(Boolean)
        .join(' ');
    }

    if (error instanceof Error) {
      const details = this.safeSerialize(error);

      return details && details !== '{}'
        ? `${error.name}: ${error.message} ${details}`
        : `${error.name}: ${error.message}`;
    }

    return this.safeSerialize(error) ?? 'Unknown error';
  }

  private safeSerialize(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}
