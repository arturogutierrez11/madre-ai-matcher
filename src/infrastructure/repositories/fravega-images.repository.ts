import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { FravegaImagesSyncConfigService } from 'src/infrastructure/services/fravega-images-sync-config.service';

export interface FravegaUpdateImagePayload {
  Type: 'url';
  Id: string;
  Url: string;
}

export interface FravegaUpdateProductPayload {
  ean: string;
  origin?: string;
  active: boolean;
  title: string;
  subTitle?: string;
  brandId: string;
  countryId: string;
  refId: string;
  primaryCategoryId: string;
  description: string;
  video?: string;
  dimensions?: {
    height: number;
    length: number;
    weight: number;
    width: number;
  };
  images: FravegaUpdateImagePayload[];
}

@Injectable()
export class FravegaImagesRepository {
  private readonly logger = new Logger(FravegaImagesRepository.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: FravegaImagesSyncConfigService,
  ) {}

  async updateProductByRefId(
    refId: string,
    payload: FravegaUpdateProductPayload,
  ): Promise<void> {
    const url = `${this.configService.fravegaApiBaseUrl}${this.configService.buildFravegaUpdatePath(refId)}`;
    const headers = this.configService.fravegaApiHeaders;

    this.logger.log(
      `Marketplace API request curl: ${this.buildCurl(url, headers, payload)}`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.put(url, payload, {
          headers,
          timeout: this.configService.requestTimeoutMs,
        }),
      );

      this.logger.log(
        `Marketplace API response status=${response.status} body=${this.safeSerialize(response.data)}`,
      );
    } catch (error) {
      if (error instanceof AxiosError) {
        this.logger.error(
          `Marketplace API error status=${error.response?.status} body=${this.safeSerialize(error.response?.data)}`,
        );
      }

      throw error;
    }
  }

  private buildCurl(
    url: string,
    headers: Record<string, string>,
    payload: FravegaUpdateProductPayload,
  ): string {
    const headerArgs = Object.entries(headers)
      .map(
        ([key, value]) => `-H '${this.escapeSingleQuotes(`${key}: ${value}`)}'`,
      )
      .join(' ');

    const body = this.escapeSingleQuotes(JSON.stringify(payload));

    return `curl -X PUT '${url}' ${headerArgs} -d '${body}'`.trim();
  }

  private safeSerialize(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private escapeSingleQuotes(value: string): string {
    return value.replace(/'/g, `'\"'\"'`);
  }
}
