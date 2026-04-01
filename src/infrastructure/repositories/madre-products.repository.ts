import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { FravegaImagesSyncConfigService } from 'src/infrastructure/services/fravega-images-sync-config.service';

export interface MadreProductImage {
  position: number;
  url: string;
}

export interface MadreProduct {
  id?: number;
  sku: string;
  images: MadreProductImage[];
}

interface MadreProductsApiResponse {
  items?: MadreProduct[];
  total?: number;
  limit?: number;
  offset?: number;
  count?: number;
  hasNext?: boolean;
  nextOffset?: number | null;
}

@Injectable()
export class MadreProductsRepository {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: FravegaImagesSyncConfigService,
  ) {}

  async getProductBySku(sku: string): Promise<MadreProduct | null> {
    const response = await firstValueFrom(
      this.httpService.get<MadreProductsApiResponse>(
        `${this.configService.madreProductsBaseUrl}${this.configService.madreProductsPath}`,
        {
          headers: this.configService.madreProductsHeaders,
          params: { sku, offset: 0, limit: 50 },
          timeout: this.configService.requestTimeoutMs,
        },
      ),
    );

    return response.data.items?.[0] ?? null;
  }
}
