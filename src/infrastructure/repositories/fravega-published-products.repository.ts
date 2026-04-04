import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { FravegaImagesSyncConfigService } from 'src/infrastructure/services/fravega-images-sync-config.service';

export interface FravegaProductImageReference {
  Type?: string;
  Id?: string;
  Url?: string;
}

export interface FravegaPublishedProductItem {
  id: string;
  sku: string;
  refId: string;
  ean: string;
  active: boolean;
  title: string;
  subTitle?: string;
  brandId: string;
  countryId: string;
  primaryCategoryId: string;
  description: string;
  video?: string;
  origin?: string;
  images?: FravegaProductImageReference[];
  status?: {
    code?: string;
    message?: string;
  };
  dimensions?: {
    height: number;
    length: number;
    weight: number;
    width: number;
  };
}

type PublishedProductsApiResponse =
  | FravegaPublishedProductItem[]
  | {
      data?: FravegaPublishedProductItem[];
      items?: FravegaPublishedProductItem[];
      total?: number;
      size?: number;
      count?: number;
      limit?: number;
      offset?: number;
      page?: number;
      totalPages?: number;
    };

export interface FravegaPublishedProductsPage {
  items: FravegaPublishedProductItem[];
  total?: number;
  size?: number;
  count?: number;
  limit?: number;
  offset?: number;
  page?: number;
  totalPages?: number;
}

@Injectable()
export class FravegaPublishedProductsRepository {
  private readonly logger = new Logger(FravegaPublishedProductsRepository.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: FravegaImagesSyncConfigService,
  ) {}

  async getPublishedProducts(params: {
    offset: number;
    limit: number;
    refIds?: string[];
  }): Promise<FravegaPublishedProductItem[]> {
    if (params.refIds?.length) {
      return this.findProductsByRefIds(params.refIds, params.limit);
    }

    const page = await this.getPublishedProductsPage(params);

    return page.items;
  }

  async findProductBySku(
    sku: string,
    limit = 100,
  ): Promise<FravegaPublishedProductItem | null> {
    const normalizedSku = sku.trim();
    let offset = 0;
    let totalPages: number | undefined;

    this.logger.log(
      `${this.tag('LOOKUP', 'cyan')} search sku=${normalizedSku}`,
    );

    while (true) {
      const page = await this.getPublishedProductsPage({ offset, limit });
      totalPages ??= page.totalPages;

      if (offset === 0 || offset % 10 === 0) {
        this.logger.log(
          `${this.tag('LOOKUP', 'cyan')} sku=${normalizedSku} page=${offset + 1}${totalPages ? `/${totalPages}` : ''}`,
        );
      }

      if (page.items.length === 0) {
        this.logger.warn(
          `${this.tag('MISS', 'yellow')} sku=${normalizedSku} not found after ${offset} pages`,
        );
        return null;
      }

      const found = page.items.find((item) => item.sku === normalizedSku);

      if (found) {
        this.logger.log(
          `${this.tag('FOUND', 'green')} sku=${normalizedSku} page=${offset + 1} refId=${found.refId}`,
        );
        return found;
      }

      if (totalPages && offset + 1 >= totalPages) {
        this.logger.warn(
          `${this.tag('MISS', 'yellow')} sku=${normalizedSku} not found after ${totalPages} pages`,
        );
        return null;
      }

      offset += 1;
    }
  }

  async findProductById(
    id: string,
  ): Promise<FravegaPublishedProductItem | null> {
    const normalizedId = id.trim();

    this.logger.log(`${this.tag('LOOKUP', 'cyan')} fetch id=${normalizedId}`);

    const response = await firstValueFrom(
      this.httpService.get<
        PublishedProductsApiResponse | FravegaPublishedProductItem
      >(
        `${this.configService.publishedProductsBaseUrl}${this.configService.publishedProductsPath}/${normalizedId}`,
        {
          headers: this.configService.publishedProductsHeaders,
          timeout: this.configService.requestTimeoutMs,
        },
      ),
    );

    const items = this.extractItems(
      response.data as PublishedProductsApiResponse,
    );

    if (items.length > 0) {
      return items[0];
    }

    if (
      response.data &&
      !Array.isArray(response.data) &&
      typeof response.data === 'object' &&
      'id' in response.data
    ) {
      return response.data as FravegaPublishedProductItem;
    }

    return null;
  }

  async getPublishedProductsPage(params: {
    offset: number;
    limit: number;
    refIds?: string[];
  }): Promise<FravegaPublishedProductsPage> {
    const response = await firstValueFrom(
      this.httpService.get<PublishedProductsApiResponse>(
        `${this.configService.publishedProductsBaseUrl}${this.configService.publishedProductsPath}`,
        {
          headers: this.configService.publishedProductsHeaders,
          params: this.configService.buildPublishedItemsParams({
            offset: params.offset,
            limit: params.limit,
            refIds: params.refIds,
          }),
          timeout: this.configService.requestTimeoutMs,
        },
      ),
    );

    const items = this.extractItems(response.data);
    const inferredPageSize = items.length > 0 ? items.length : undefined;

    const page: FravegaPublishedProductsPage = {
      items,
      total: Array.isArray(response.data)
        ? undefined
        : this.toOptionalNumber(response.data.total),
      size: Array.isArray(response.data)
        ? inferredPageSize
        : (this.toOptionalNumber(response.data.size) ?? inferredPageSize),
      count: Array.isArray(response.data)
        ? undefined
        : this.toOptionalNumber(response.data.count),
      limit: Array.isArray(response.data)
        ? undefined
        : this.toOptionalNumber(response.data.limit),
      offset: Array.isArray(response.data)
        ? undefined
        : this.toOptionalNumber(response.data.offset),
      page: Array.isArray(response.data)
        ? undefined
        : this.toOptionalNumber(response.data.page),
      totalPages: Array.isArray(response.data)
        ? undefined
        : this.resolveTotalPages(response.data, inferredPageSize),
    };

    if (!params.refIds?.length) {
      return page;
    }

    const refIds = new Set(params.refIds);

    return {
      ...page,
      items: items.filter((item) => refIds.has(item.refId)),
    };
  }

  private async findProductsByRefIds(
    refIds: string[],
    limit: number,
  ): Promise<FravegaPublishedProductItem[]> {
    const pendingRefIds = new Set(refIds);
    const foundItems: FravegaPublishedProductItem[] = [];
    let offset = 0;

    while (pendingRefIds.size > 0) {
      const page = await this.getPublishedProductsPage({
        offset,
        limit,
      });

      if (page.items.length === 0) {
        break;
      }

      for (const item of page.items) {
        if (pendingRefIds.has(item.refId)) {
          foundItems.push(item);
          pendingRefIds.delete(item.refId);
        }
      }

      offset += 1;
    }

    return foundItems;
  }

  private resolveTotalPages(
    response: Exclude<
      PublishedProductsApiResponse,
      FravegaPublishedProductItem[]
    >,
    fallbackSize?: number,
  ): number | undefined {
    const totalPages = this.toOptionalNumber(response.totalPages);

    if (typeof totalPages === 'number' && totalPages > 0) {
      return totalPages;
    }

    const total = this.toOptionalNumber(response.total);
    const size = this.toOptionalNumber(response.size) ?? fallbackSize;

    if (
      typeof total === 'number' &&
      total >= 0 &&
      typeof size === 'number' &&
      size > 0
    ) {
      return Math.ceil(total / size);
    }

    return undefined;
  }

  private toOptionalNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private extractItems(
    response: PublishedProductsApiResponse,
  ): FravegaPublishedProductItem[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (Array.isArray(response.items)) {
      return response.items;
    }

    if (Array.isArray(response.data)) {
      return response.data;
    }

    if (
      response.data &&
      typeof response.data === 'object' &&
      Array.isArray(
        (response.data as { items?: FravegaPublishedProductItem[] }).items,
      )
    ) {
      return (response.data as { items: FravegaPublishedProductItem[] }).items;
    }

    return [];
  }

  private tag(label: string, color: 'cyan' | 'green' | 'yellow'): string {
    return `${this.ansi(color)}[${label}]${this.ansi('reset')}`;
  }

  private ansi(color: 'cyan' | 'green' | 'yellow' | 'reset'): string {
    const colors = {
      reset: '\u001b[0m',
      green: '\u001b[32m',
      yellow: '\u001b[33m',
      cyan: '\u001b[36m',
    } as const;

    return colors[color];
  }
}
