import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { IMadreCategoryMatchRepository } from 'src/domains/interface/madre-category-match.repository.interface';

type MegatoneCategoryMatch = {
  meliCategoryId: string;
  meliCategoryPath: string;
  megatoneCategoryId: string;
  megatoneCategoryPath: string;
};

type ExistsResponse = {
  exists: boolean;
};

@Injectable()
export class MadreMegatoneCategoryMatchRepository implements IMadreCategoryMatchRepository {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private get baseUrl(): string {
    return this.config.get<string>('MADRE_API')!;
  }

  async exists(meliCategoryId: string): Promise<boolean> {
    const url = `${this.baseUrl}/categories/megatone/exists/${meliCategoryId}`;

    const response = await firstValueFrom(
      this.http.get<ExistsResponse>(url, {
        headers: { accept: '*/*' },
      }),
    );

    return response.data.exists;
  }

  async save(match: MegatoneCategoryMatch): Promise<void> {
    const url = `${this.baseUrl}/categories/megatone`;

    await firstValueFrom(
      this.http.post(url, match, {
        headers: {
          'Content-Type': 'application/json',
          accept: '*/*',
        },
      }),
    );
  }

  async saveBulk(matches: MegatoneCategoryMatch[]): Promise<void> {
    const url = `${this.baseUrl}/categories/megatone/bulk`;

    await firstValueFrom(
      this.http.post(
        url,
        { items: matches }, // 👈 requerido por tu API
        {
          headers: {
            'Content-Type': 'application/json',
            accept: '*/*',
          },
        },
      ),
    );
  }
}
