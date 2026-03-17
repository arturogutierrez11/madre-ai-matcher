import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IBrandMatchRepository } from 'src/domains/interface/brands/IBrandMatchRepository';

@Injectable()
export class BrandMatchRepository implements IBrandMatchRepository {
  constructor(private readonly http: HttpService) {}

  async saveMatch(data: {
    meliBrand: string;
    fravegaBrandId: string;
    fravegaBrandName: string;
    confidence: number;
  }) {
    const response = await firstValueFrom(
      this.http.post(
        'https://api.madre.loquieroaca.com/api/matcher/brands',
        data,
        {
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    return response.data;
  }

  async existsByMeliBrand(meliBrand: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.http.get(
          `https://api.madre.loquieroaca.com/api/matcher/brands/meli/${encodeURIComponent(
            meliBrand,
          )}/exists`,
        ),
      );

      return response.data.exists;
    } catch (error) {
      return false;
    }
  }
}
