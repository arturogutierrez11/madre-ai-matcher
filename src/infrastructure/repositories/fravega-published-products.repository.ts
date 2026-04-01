import { Injectable } from '@nestjs/common';
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
      count?: number;
      limit?: number;
      offset?: number;
    };

export interface FravegaPublishedProductsPage {
  items: FravegaPublishedProductItem[];
  total?: number;
  count?: number;
  limit?: number;
  offset?: number;
}

@Injectable()
export class FravegaPublishedProductsRepository {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: FravegaImagesSyncConfigService,
  ) {}

  async getPublishedProducts(params: {
    offset: number;
    limit: number;
    refIds?: string[];
  }): Promise<FravegaPublishedProductItem[]> {
    const page = await this.getPublishedProductsPage(params);

    return page.items;
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

    const items = Array.isArray(response.data)
      ? response.data
      : (response.data.data ?? response.data.items ?? []);

    const page: FravegaPublishedProductsPage = {
      items,
      total: Array.isArray(response.data) ? undefined : response.data.total,
      count: Array.isArray(response.data) ? undefined : response.data.count,
      limit: Array.isArray(response.data) ? undefined : response.data.limit,
      offset: Array.isArray(response.data) ? undefined : response.data.offset,
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
}
