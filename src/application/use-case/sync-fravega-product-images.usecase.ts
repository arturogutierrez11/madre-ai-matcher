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
  batchConcurrency?: number;
  perProductImageConcurrency?: number;
  maxImagesPerProduct?: number;
  skipExistingUploadChecks?: boolean;
}

export interface SyncAllFravegaProductImagesInput {
  startOffset?: number;
  limit?: number;
  dryRun?: boolean;
  maxBatches?: number;
  batchConcurrency?: number;
  perProductImageConcurrency?: number;
  maxImagesPerProduct?: number;
  skipExistingUploadChecks?: boolean;
  fromEnd?: boolean;
  onProgress?: (progress: SyncAllFravegaProductImagesProgress) => void;
}

export interface SyncAllFravegaProductImagesProgress {
  phase: 'resolving-last-offset' | 'processing-pages' | 'completed-cycle';
  currentOffset?: number;
  lastNonEmptyOffset?: number;
  probeOffset?: number;
  batch?: number;
  totalRequested?: number;
  processed?: number;
  skipped?: number;
  failed?: number;
  message?: string;
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
  fromEnd: boolean;
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

    this.logger.log(
      `${this.tag('PAGE', 'blue')} loaded=${publishedProducts.length} valid=${products.length} page=${offset + 1}`,
    );

    await this.processInBatchesWithConcurrency(
      products,
      async (product) => {
        try {
          const result = await this.processSingleProduct({
            product,
            dryRun,
            perProductImageConcurrency:
              input.perProductImageConcurrency ??
              this.configService.perProductImageConcurrency,
            maxImagesPerProduct:
              input.maxImagesPerProduct ??
              this.configService.maxImagesPerProduct,
            skipExistingUploadChecks: input.skipExistingUploadChecks ?? false,
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
            `${this.tag('FAIL', 'red')} sku=${product.sku} refId=${product.refId} ${message}`,
          );
        }
      },
      input.batchConcurrency ?? this.configService.batchConcurrency,
    );

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

  async executeSingleBySku(input: {
    sku: string;
    dryRun?: boolean;
    perProductImageConcurrency?: number;
    maxImagesPerProduct?: number;
    skipExistingUploadChecks?: boolean;
  }): Promise<SyncFravegaProductImagesResult> {
    this.logger.log(`${this.tag('MANUAL', 'cyan')} start sku=${input.sku}`);

    const product =
      await this.fravegaPublishedProductsRepository.findProductBySku(input.sku);

    if (!product) {
      this.logger.warn(
        `${this.tag('MISS', 'yellow')} sku=${input.sku} not found`,
      );

      return {
        totalRequested: 1,
        processed: 0,
        patched: 0,
        skipped: 0,
        failed: 1,
        products: [],
        failures: [
          {
            fravegaSku: input.sku,
            error: 'Product not found in seller-center',
          },
        ],
      };
    }

    this.logger.log(
      `${this.tag('FOUND', 'green')} sku=${product.sku} refId=${product.refId}`,
    );

    try {
      const result = await this.processSingleProduct({
        product,
        dryRun: input.dryRun ?? false,
        perProductImageConcurrency:
          input.perProductImageConcurrency ??
          this.configService.perProductImageConcurrency,
        maxImagesPerProduct:
          input.maxImagesPerProduct ?? this.configService.maxImagesPerProduct,
        skipExistingUploadChecks: input.skipExistingUploadChecks ?? false,
      });

      if (result === null) {
        this.logger.log(
          `${this.tag('SKIP', 'yellow')} sku=${product.sku} refId=${product.refId}`,
        );

        return {
          totalRequested: 1,
          processed: 0,
          patched: 0,
          skipped: 1,
          failed: 0,
          products: [],
          failures: [],
        };
      }

      return {
        totalRequested: 1,
        processed: 1,
        patched: result.updated ? 1 : 0,
        skipped: 0,
        failed: 0,
        products: [result],
        failures: [],
      };
    } catch (error) {
      const message = this.formatError(error);

      this.logger.error(
        `${this.tag('FAIL', 'red')} sku=${product.sku} refId=${product.refId} ${message}`,
      );

      return {
        totalRequested: 1,
        processed: 1,
        patched: 0,
        skipped: 0,
        failed: 1,
        products: [],
        failures: [
          {
            refId: product.refId,
            fravegaSku: product.sku,
            error: message,
          },
        ],
      };
    }
  }

  async executeSingleByItemId(input: {
    id: string;
    dryRun?: boolean;
    perProductImageConcurrency?: number;
    maxImagesPerProduct?: number;
    skipExistingUploadChecks?: boolean;
  }): Promise<SyncFravegaProductImagesResult> {
    this.logger.log(`${this.tag('MANUAL', 'cyan')} start id=${input.id}`);

    const product =
      await this.fravegaPublishedProductsRepository.findProductById(input.id);

    if (!product) {
      this.logger.warn(
        `${this.tag('MISS', 'yellow')} id=${input.id} not found`,
      );

      return {
        totalRequested: 1,
        processed: 0,
        patched: 0,
        skipped: 0,
        failed: 1,
        products: [],
        failures: [{ error: 'Product not found in seller-center by id' }],
      };
    }

    this.logger.log(
      `${this.tag('FOUND', 'green')} id=${product.id} sku=${product.sku} refId=${product.refId}`,
    );

    try {
      const result = await this.processSingleProduct({
        product,
        dryRun: input.dryRun ?? false,
        perProductImageConcurrency:
          input.perProductImageConcurrency ??
          this.configService.perProductImageConcurrency,
        maxImagesPerProduct:
          input.maxImagesPerProduct ?? this.configService.maxImagesPerProduct,
        skipExistingUploadChecks: input.skipExistingUploadChecks ?? false,
      });

      if (result === null) {
        return {
          totalRequested: 1,
          processed: 0,
          patched: 0,
          skipped: 1,
          failed: 0,
          products: [],
          failures: [],
        };
      }

      return {
        totalRequested: 1,
        processed: 1,
        patched: result.updated ? 1 : 0,
        skipped: 0,
        failed: 0,
        products: [result],
        failures: [],
      };
    } catch (error) {
      const message = this.formatError(error);

      this.logger.error(
        `${this.tag('FAIL', 'red')} id=${product.id} sku=${product.sku} refId=${product.refId} ${message}`,
      );

      return {
        totalRequested: 1,
        processed: 1,
        patched: 0,
        skipped: 0,
        failed: 1,
        products: [],
        failures: [
          {
            refId: product.refId,
            fravegaSku: product.sku,
            error: message,
          },
        ],
      };
    }
  }

  async executeAll(
    input: SyncAllFravegaProductImagesInput,
  ): Promise<SyncAllFravegaProductImagesResult> {
    const fromEnd = input.fromEnd ?? false;
    const limit = input.limit ?? 100;
    const dryRun = input.dryRun ?? false;
    const maxBatches = input.maxBatches;
    const startedAtOffset = fromEnd
      ? await this.resolveLastOffset(limit, input.startOffset, input.onProgress)
      : (input.startOffset ?? 0);

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

      input.onProgress?.({
        phase: 'processing-pages',
        currentOffset,
        batch: batches + 1,
        totalRequested,
        processed,
        skipped,
        failed,
        message: `Processing page ${currentOffset + 1}`,
      });

      this.logger.log(
        `${this.tag('BATCH', 'blue')} start=${batches + 1} page=${currentOffset + 1} dryRun=${dryRun} fromEnd=${fromEnd}`,
      );

      const batchResult = await this.execute({
        offset: currentOffset,
        limit,
        dryRun,
        batchConcurrency: input.batchConcurrency,
        perProductImageConcurrency: input.perProductImageConcurrency,
        maxImagesPerProduct: input.maxImagesPerProduct,
        skipExistingUploadChecks: input.skipExistingUploadChecks,
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
        this.logger.log(
          `${this.tag('BATCH', 'blue')} done=${batches} page=${currentOffset + 1} empty`,
        );
        break;
      }

      this.logger.log(
        `${this.tag('BATCH', 'blue')} done=${batches} page=${currentOffset + 1} processed=${batchResult.processed} patched=${batchResult.patched} skipped=${batchResult.skipped} failed=${batchResult.failed}`,
      );

      if (fromEnd) {
        if (currentOffset === 0) {
          break;
        }

        currentOffset = Math.max(0, currentOffset - 1);
      } else {
        currentOffset += 1;
      }
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
      fromEnd,
      batchResults,
      failures,
    };
  }

  private async processSingleProduct(input: {
    product: FravegaPublishedProductItem;
    dryRun: boolean;
    perProductImageConcurrency: number;
    maxImagesPerProduct: number;
    skipExistingUploadChecks: boolean;
  }): Promise<ProductSyncSuccess | null> {
    const skipReason = this.getSkipReason(input.product);

    if (skipReason) {
      this.logger.log(
        `${this.tag('SKIP', 'yellow')} sku=${input.product.sku} refId=${input.product.refId} reason="${skipReason}"`,
      );

      return null;
    }

    if (
      await this.productImagesRepository.hasProcessedProduct(
        input.product.sku,
        input.product.refId,
      )
    ) {
      this.logger.log(
        `${this.tag('CACHE', 'cyan')} sku=${input.product.sku} refId=${input.product.refId} hit but Fravega still has no images; retrying`,
      );
    }

    this.logger.log(
      `${this.tag('ITEM', 'green')} sku=${input.product.sku} refId=${input.product.refId}`,
    );
    this.logger.log(
      `${this.tag('MADRE', 'cyan')} load sku=${input.product.sku} refId=${input.product.refId}`,
    );

    const madreProduct = await this.madreProductsRepository.getProductBySku(
      input.product.refId,
    );

    if (!madreProduct?.images?.length) {
      throw new Error('Product has no source images in madre-api');
    }

    const images = this.selectProcessableImages(
      madreProduct.images,
      input.maxImagesPerProduct,
    );

    if (!images.length) {
      throw new Error('Product images are empty after filtering invalid URLs');
    }

    const preparedImages = await this.mapInBatches(
      images,
      async (image) =>
        this.prepareProductImage(
          input.product.refId,
          image,
          input.dryRun,
          input.skipExistingUploadChecks,
        ),
      input.perProductImageConcurrency,
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
      this.logger.log(
        `${this.tag('UPDATE', 'blue')} sku=${input.product.sku} refId=${input.product.refId} images=${payload.images.length}`,
      );

      const updateResponse =
        await this.fravegaImagesRepository.updateProductByRefId(
          input.product.refId,
          payload,
        );

      this.logger.log(
        `${this.tag('DONE', 'green')} sku=${input.product.sku} refId=${input.product.refId} status=${updateResponse.status}`,
      );

      await this.productImagesRepository.markProductProcessed(
        input.product.sku,
        input.product.refId,
      );
      this.logger.log(
        `${this.tag('CACHE', 'cyan')} saved sku=${input.product.sku} refId=${input.product.refId}`,
      );
    } else {
      this.logger.log(
        `${this.tag('DRY', 'yellow')} sku=${input.product.sku} refId=${input.product.refId} images=${payload.images.length}`,
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
    skipExistingUploadChecks: boolean;
  }): Promise<EnsuredProductImage> {
    const existingCdnUrl = await this.resolveExistingProductImageUrl({
      sku: input.sku,
      position: input.image.position,
      dryRun: input.dryRun,
      skipExistingUploadChecks: input.skipExistingUploadChecks,
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
    skipExistingUploadChecks: boolean,
  ): Promise<PreparedProductImage> {
    this.logger.log(
      `${this.tag('IMG', 'blue')} refId=${sku} position=${image.position} start`,
    );

    const ensuredImage = await this.ensureProductImage({
      sku,
      image,
      dryRun,
      skipExistingUploadChecks,
    });

    this.logger.log(
      `${this.tag('IMG', ensuredImage.reusedExistingImage ? 'yellow' : 'green')} refId=${sku} position=${image.position} ${ensuredImage.reusedExistingImage ? 'reused' : 'ready'}`,
    );

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
    skipExistingUploadChecks: boolean;
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

    if (input.skipExistingUploadChecks) {
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
    maxImagesPerProduct: number,
  ): MadreProductImage[] {
    return images
      .filter((image) => typeof image.url === 'string' && image.url.length > 0)
      .sort((left, right) => left.position - right.position)
      .slice(0, maxImagesPerProduct);
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

  private getSkipReason(product: FravegaPublishedProductItem): string | null {
    if (this.productAlreadyHasImages(product)) {
      return 'already has images in Fravega';
    }

    if (product.status?.code !== 'incomplete') {
      return `status.code is ${product.status?.code ?? 'undefined'}`;
    }

    return null;
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
    await this.processInBatchesWithConcurrency(
      items,
      async (item) => handler(item),
      this.configService.batchConcurrency,
    );
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

  private async resolveLastOffset(
    limit: number,
    startOffset?: number,
    onProgress?: (progress: SyncAllFravegaProductImagesProgress) => void,
  ): Promise<number> {
    if (startOffset !== undefined) {
      return startOffset;
    }

    const firstPage =
      await this.fravegaPublishedProductsRepository.getPublishedProductsPage({
        offset: 0,
        limit,
      });

    this.logger.log(
      `First seller-center page metadata total=${firstPage.total ?? 'undefined'} size=${firstPage.size ?? 'undefined'} totalPages=${firstPage.totalPages ?? 'undefined'} page=${firstPage.page ?? 'undefined'} items=${firstPage.items.length}`,
    );

    if (
      typeof firstPage.total === 'number' &&
      firstPage.total >= 0 &&
      typeof firstPage.size === 'number' &&
      firstPage.size > 0
    ) {
      const totalPages = Math.ceil(firstPage.total / firstPage.size);
      const lastPageIndex = Math.max(0, totalPages - 1);

      onProgress?.({
        phase: 'resolving-last-offset',
        lastNonEmptyOffset: lastPageIndex,
        message: `Resolved last page from total=${firstPage.total} size=${firstPage.size}`,
      });

      return lastPageIndex;
    }

    if (firstPage.totalPages && firstPage.totalPages > 0) {
      const lastPageIndex = firstPage.totalPages - 1;

      onProgress?.({
        phase: 'resolving-last-offset',
        lastNonEmptyOffset: lastPageIndex,
        message: `Resolved last page from totalPages=${firstPage.totalPages}`,
      });

      return lastPageIndex;
    }

    return this.findLastNonEmptyOffsetWithoutTotal(limit, onProgress);
  }

  private async findLastNonEmptyOffsetWithoutTotal(
    limit: number,
    onProgress?: (progress: SyncAllFravegaProductImagesProgress) => void,
  ): Promise<number> {
    const firstPage =
      await this.fravegaPublishedProductsRepository.getPublishedProductsPage({
        offset: 0,
        limit,
      });

    if (firstPage.items.length === 0) {
      return 0;
    }

    let previousProbeIndex = 0;
    let previousProbeFingerprint = this.getPageFingerprint(firstPage.items);
    let lastKnownDifferentIndex = 0;
    let high = 1;

    onProgress?.({
      phase: 'resolving-last-offset',
      probeOffset: high,
      lastNonEmptyOffset: 0,
      message: `Resolving last page. Probing pageIndex=${high}`,
    });

    while (true) {
      const page =
        await this.fravegaPublishedProductsRepository.getPublishedProductsPage({
          offset: high,
          limit,
        });

      if (page.items.length === 0) {
        return this.findLastNonEmptyPageByEmptyBoundary(
          previousProbeIndex,
          high - 1,
          limit,
          onProgress,
        );
      }

      const fingerprint = this.getPageFingerprint(page.items);

      if (fingerprint === previousProbeFingerprint) {
        if (previousProbeIndex === 0) {
          return 0;
        }

        return this.findFirstPageWithFingerprint(
          previousProbeFingerprint,
          lastKnownDifferentIndex + 1,
          previousProbeIndex,
          limit,
          onProgress,
        );
      }

      lastKnownDifferentIndex = previousProbeIndex;
      previousProbeIndex = high;
      previousProbeFingerprint = fingerprint;
      high *= 2;

      onProgress?.({
        phase: 'resolving-last-offset',
        probeOffset: high,
        lastNonEmptyOffset: previousProbeIndex,
        message: `Resolving last page. Probing pageIndex=${high}`,
      });
    }
  }

  private async findLastNonEmptyPageByEmptyBoundary(
    left: number,
    right: number,
    limit: number,
    onProgress?: (progress: SyncAllFravegaProductImagesProgress) => void,
  ): Promise<number> {
    let low = left;
    let high = right;
    let lastNonEmptyPage = left;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const page =
        await this.fravegaPublishedProductsRepository.getPublishedProductsPage({
          offset: middle,
          limit,
        });

      if (page.items.length > 0) {
        lastNonEmptyPage = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }

      onProgress?.({
        phase: 'resolving-last-offset',
        probeOffset: middle,
        lastNonEmptyOffset: lastNonEmptyPage,
        message: `Binary search pageIndex=${middle}`,
      });
    }

    return lastNonEmptyPage;
  }

  private async findFirstPageWithFingerprint(
    fingerprint: string,
    left: number,
    right: number,
    limit: number,
    onProgress?: (progress: SyncAllFravegaProductImagesProgress) => void,
  ): Promise<number> {
    let low = left;
    let high = right;
    let firstMatchingPage = right;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const page =
        await this.fravegaPublishedProductsRepository.getPublishedProductsPage({
          offset: middle,
          limit,
        });

      const currentFingerprint = this.getPageFingerprint(page.items);

      if (currentFingerprint === fingerprint) {
        firstMatchingPage = middle;
        high = middle - 1;
      } else {
        low = middle + 1;
      }

      onProgress?.({
        phase: 'resolving-last-offset',
        probeOffset: middle,
        lastNonEmptyOffset: firstMatchingPage,
        message: `Fingerprint search pageIndex=${middle}`,
      });
    }

    return firstMatchingPage;
  }

  private getPageFingerprint(items: FravegaPublishedProductItem[]): string {
    return items.map((item) => item.id).join('|');
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

  private tag(
    label: string,
    color: 'cyan' | 'green' | 'yellow' | 'red' | 'blue',
  ): string {
    return `${this.ansi(color)}[${label}]${this.ansi('reset')}`;
  }

  private ansi(
    color: 'cyan' | 'green' | 'yellow' | 'red' | 'blue' | 'reset',
  ): string {
    const colors = {
      reset: '\u001b[0m',
      red: '\u001b[31m',
      green: '\u001b[32m',
      yellow: '\u001b[33m',
      blue: '\u001b[34m',
      cyan: '\u001b[36m',
    } as const;

    return colors[color];
  }
}
