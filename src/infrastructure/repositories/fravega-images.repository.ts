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

export interface FravegaUpdateProductResponse {
  status: number;
  data: unknown;
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
  ): Promise<FravegaUpdateProductResponse> {
    const url = `${this.configService.fravegaApiBaseUrl}${this.configService.buildFravegaUpdatePath(refId)}`;
    const headers = this.configService.fravegaApiHeaders;

    this.logger.log(
      `${this.tag('FVG', 'cyan')} ${this.color('PUT', 'blue')} refId=${refId} images=${payload.images.length} url=${url}`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.put(url, payload, {
          headers,
          timeout: this.configService.requestTimeoutMs,
        }),
      );

      this.logger.log(
        `${this.tag('FVG', 'cyan')} ${this.color('OK', 'green')} refId=${refId} status=${response.status}`,
      );

      if (response.status < 200 || response.status >= 300) {
        throw new Error(
          `Marketplace API returned unexpected status ${response.status}`,
        );
      }

      return {
        status: response.status,
        data: response.data,
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        this.logger.error(
          `${this.tag('FVG', 'cyan')} ${this.color('ERR', 'red')} refId=${refId} status=${error.response?.status ?? 'unknown'} body=${this.safeSerialize(error.response?.data)}`,
        );
      }

      throw error;
    }
  }

  private safeSerialize(value: unknown): string {
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

  private color(
    text: string,
    color: 'cyan' | 'green' | 'yellow' | 'red' | 'blue' | 'reset',
  ): string {
    return `${this.ansi(color)}${text}${this.ansi('reset')}`;
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
