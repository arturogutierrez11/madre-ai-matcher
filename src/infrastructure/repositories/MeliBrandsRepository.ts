import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IMeliBrandsRepository } from 'src/domains/interface/brands/IMeliBrandsRepository';
import { brandsCache } from '../cache/brandsCache';

@Injectable()
export class MeliBrandsRepository implements IMeliBrandsRepository {
  constructor(private readonly http: HttpService) {}

  async getBrands(page: number, limit: number): Promise<string[]> {
    const key = `meli_brands_${page}_${limit}`;

    const cached = brandsCache.get(key) as string[];

    if (cached) {
      return cached;
    }

    const response = await firstValueFrom(
      this.http.get(
        `https://api.madre.loquieroaca.com/api/analytics/brands/all?page=${page}&limit=${limit}`,
        { headers: { accept: '*/*' } },
      ),
    );

    const brands = response.data.items.map((b: any) => b.brand);

    brandsCache.set(key, brands);

    return brands;
  }
}
