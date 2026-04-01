import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { brandsCache } from 'src/infrastructure/cache/brandsCache';

export interface MegatoneBrand {
  id: string;
  name: string;
}

type MegatoneBrandsResponse = {
  page: number;
  count: number;
  brands: {
    codigo: number;
    descripcion: string;
  }[];
};

@Injectable()
export class MegatoneBrandsRepository {
  constructor(private readonly http: HttpService) {}

  async getBrands(): Promise<MegatoneBrand[]> {
    const cached = brandsCache.get('megatone_brands') as MegatoneBrand[];

    if (cached) {
      console.log('Using cached Megatone brands');
      return cached;
    }

    console.log('Loading Megatone brands...');

    let page = 1;
    const allBrands: MegatoneBrand[] = [];

    while (true) {
      const response = await firstValueFrom(
        this.http.get<MegatoneBrandsResponse>(
          `https://api.marketplace.loquieroaca.com/megatone/brands?page=${page}`,
          {
            headers: { accept: 'application/json' },
          },
        ),
      );

      const data = response.data.brands;

      if (!data.length) break;

      const normalized = data.map((b) => ({
        id: String(b.codigo),
        name: b.descripcion,
      }));

      allBrands.push(...normalized);

      console.log(`Loaded page ${page} → ${data.length} brands`);

      page++;
    }

    console.log(`Total Megatone brands: ${allBrands.length}`);

    brandsCache.set('megatone_brands', allBrands);

    return allBrands;
  }
}
