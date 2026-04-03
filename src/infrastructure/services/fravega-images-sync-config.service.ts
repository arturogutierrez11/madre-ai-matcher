import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type HeadersMap = Record<string, string>;

export interface PublishedItemsRequest {
  offset: number;
  limit: number;
  refIds?: string[];
}

@Injectable()
export class FravegaImagesSyncConfigService {
  constructor(private readonly configService: ConfigService) {}

  get publishedProductsBaseUrl(): string {
    return this.getRequired('FRAVEGA_IMAGES_PUBLISHED_PRODUCTS_BASE_URL');
  }

  get publishedProductsPath(): string {
    return (
      this.configService.get<string>(
        'FRAVEGA_IMAGES_PUBLISHED_PRODUCTS_PATH',
      ) ?? '/api/v1/item'
    );
  }

  get publishedProductsHeaders(): HeadersMap {
    return this.getHeaders('FRAVEGA_IMAGES_PUBLISHED_PRODUCTS_HEADERS');
  }

  get madreProductsBaseUrl(): string {
    return this.getRequired('FRAVEGA_IMAGES_MADRE_API_BASE_URL');
  }

  get madreProductsPath(): string {
    return (
      this.configService.get<string>('FRAVEGA_IMAGES_MADRE_PRODUCT_PATH') ??
      '/api/products/madre'
    );
  }

  get madreProductsHeaders(): HeadersMap {
    return this.getHeaders('FRAVEGA_IMAGES_MADRE_API_HEADERS');
  }

  get fravegaApiBaseUrl(): string {
    return (
      this.configService.get<string>('FRAVEGA_IMAGES_FRAVEGA_API_BASE_URL') ??
      this.publishedProductsBaseUrl
    );
  }

  get fravegaUpdatePathTemplate(): string {
    return (
      this.configService.get<string>(
        'FRAVEGA_IMAGES_FRAVEGA_UPDATE_PATH_TEMPLATE',
      ) ?? '/fravega/update/refeId/{refId}'
    );
  }

  get fravegaApiHeaders(): HeadersMap {
    return this.getHeaders('FRAVEGA_IMAGES_FRAVEGA_API_HEADERS');
  }

  get spacesRegion(): string {
    return (
      this.configService.get<string>('FRAVEGA_IMAGES_SPACES_REGION') ?? 'nyc3'
    );
  }

  get spacesEndpoint(): string {
    const configured = this.configService.get<string>(
      'FRAVEGA_IMAGES_SPACES_ENDPOINT',
    );

    if (configured) {
      return configured;
    }

    return `https://${this.spacesRegion}.digitaloceanspaces.com`;
  }

  get spacesBucket(): string {
    return (
      this.configService.get<string>('FRAVEGA_IMAGES_SPACES_BUCKET') ??
      'product-images-fravega'
    );
  }

  get spacesCdnBaseUrl(): string {
    const configured = this.configService.get<string>(
      'FRAVEGA_IMAGES_SPACES_CDN_BASE_URL',
    );

    if (configured) {
      return configured.replace(/\/$/, '');
    }

    return `https://${this.spacesBucket}.${this.spacesRegion}.cdn.digitaloceanspaces.com`;
  }

  get spacesAccessKeyId(): string {
    return this.getRequired('FRAVEGA_IMAGES_SPACES_ACCESS_KEY_ID');
  }

  get spacesSecretAccessKey(): string {
    return this.getRequired('FRAVEGA_IMAGES_SPACES_SECRET_ACCESS_KEY');
  }

  get targetImageSize(): number {
    return this.getNumber('FRAVEGA_IMAGES_TARGET_SIZE', 1000);
  }

  get jpgQuality(): number {
    return this.getNumber('FRAVEGA_IMAGES_JPG_QUALITY', 90);
  }

  get batchConcurrency(): number {
    return this.getNumber('FRAVEGA_IMAGES_BATCH_CONCURRENCY', 4);
  }

  get perProductImageConcurrency(): number {
    return this.getNumber('FRAVEGA_IMAGES_PER_PRODUCT_IMAGE_CONCURRENCY', 3);
  }

  get maxImagesPerProduct(): number {
    return this.getNumber('FRAVEGA_IMAGES_MAX_IMAGES_PER_PRODUCT', 5);
  }

  get skipExistingUploads(): boolean {
    return this.getBoolean('FRAVEGA_IMAGES_SKIP_EXISTING_UPLOADS', true);
  }

  get patchEnabled(): boolean {
    return this.getBoolean('FRAVEGA_IMAGES_PATCH_ENABLED', true);
  }

  get uploadEnabled(): boolean {
    return this.getBoolean('FRAVEGA_IMAGES_UPLOAD_ENABLED', true);
  }

  get requestTimeoutMs(): number {
    return this.getNumber('FRAVEGA_IMAGES_REQUEST_TIMEOUT_MS', 30000);
  }

  buildPublishedItemsParams(
    input: PublishedItemsRequest,
  ): Record<string, string | number> {
    return {
      page: input.offset + 1,
    };
  }

  buildFravegaUpdatePath(refId: string): string {
    return this.fravegaUpdatePathTemplate.replace('{refId}', refId);
  }

  buildSpacesObjectKey(sku: string, position: number): string {
    return `fravega/${sku}/${position}.jpg`;
  }

  buildSpacesCdnUrl(sku: string, position: number): string {
    return `${this.spacesCdnBaseUrl}/${this.buildSpacesObjectKey(sku, position)}`;
  }

  private getHeaders(key: string): HeadersMap {
    const rawValue = this.configService.get<string>(key);

    if (!rawValue) {
      return {};
    }

    try {
      const parsed = JSON.parse(rawValue) as HeadersMap;

      return Object.entries(parsed).reduce<HeadersMap>(
        (acc, [header, value]) => {
          if (typeof value === 'string' && value.length > 0) {
            acc[header] = value;
          }

          return acc;
        },
        {},
      );
    } catch (error) {
      throw new Error(`Invalid JSON in ${key}: ${(error as Error).message}`);
    }
  }

  private getRequired(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }

    return value;
  }

  private getNumber(key: string, fallback: number): number {
    const rawValue = this.configService.get<string>(key);

    if (!rawValue) {
      return fallback;
    }

    const parsedValue = Number(rawValue);

    if (Number.isNaN(parsedValue)) {
      throw new Error(`Invalid number in ${key}: ${rawValue}`);
    }

    return parsedValue;
  }

  private getBoolean(key: string, fallback: boolean): boolean {
    const rawValue = this.configService.get<string>(key);

    if (!rawValue) {
      return fallback;
    }

    return rawValue.toLowerCase() === 'true';
  }
}
