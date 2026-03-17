import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IFravegaBrandsRepository } from 'src/domains/interface/brands/FravegaBrandsRepository.interface';
import { brandsCache } from '../cache/brandsCache';

export interface FravegaBrand {
  id: string;
  name: string;
}

@Injectable()
export class FravegaBrandsRepository implements IFravegaBrandsRepository {
  constructor(private readonly http: HttpService) {}

  async getBrands(): Promise<FravegaBrand[]> {
    const cached = brandsCache.get('fravega_brands') as FravegaBrand[];

    if (cached) {
      return cached;
    }

    const response = await firstValueFrom(
      this.http.get('https://api.marketplace.loquieroaca.com/fravega/brands', {
        headers: { accept: '*/*' },
      }),
    );

    const brands = response.data;

    brandsCache.set('fravega_brands', brands);

    return brands;
  }
}
