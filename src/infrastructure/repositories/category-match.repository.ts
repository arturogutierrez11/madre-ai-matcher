import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { ICategoryMatchRepository } from 'src/domains/interface/category-match.repository.interface';

@Injectable()
export class CategoryMatchRepository implements ICategoryMatchRepository {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async exists(sku: string): Promise<boolean> {
    const baseUrl = this.config.get<string>('MADRE_API');

    const url = `${baseUrl}/categories/fravega/categories/match/exists/${sku}`;

    const response = await firstValueFrom(
      this.http.get(url, {
        headers: { accept: '*/*' },
      }),
    );

    return response.data.hasCategoryMatch;
  }

  async save(match: {
    sku: string;
    categoryId: string;
    categoryName: string;
    categoryPath: string;
  }): Promise<void> {
    const baseUrl = this.config.get<string>('MADRE_API');

    const url = `${baseUrl}/categories/fravega/categories/match`;

    await firstValueFrom(
      this.http.post(
        url,
        {
          sku: match.sku,
          categoryId: match.categoryId,
          categoryName: match.categoryName,
          categoryPath: match.categoryPath,
        },
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
