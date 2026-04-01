import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

type ExistsResponse = {
  exists: boolean;
};

@Injectable()
export class MegatoneBrandMatchRepository {
  constructor(private readonly http: HttpService) {}

  async saveMatch(data: {
    meliBrand: string;
    megatoneBrandId: string;
    megatoneBrandName: string;
    confidence: number;
  }) {
    console.log('💾 SAVING:', data);

    try {
      const response = await firstValueFrom(
        this.http.post(
          'https://api.madre.loquieroaca.com/api/matcher/brands/megatone',
          data,
          {
            headers: {
              'Content-Type': 'application/json',
              accept: '*/*',
            },
          },
        ),
      );

      console.log('✅ SAVED OK:', response.data);

      return response.data;
    } catch (error: any) {
      console.error('❌ SAVE ERROR:', error?.response?.data || error.message);
      throw error;
    }
  }

  async existsByMegatoneBrandId(megatoneBrandId: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.http.get<ExistsResponse>(
          `https://api.madre.loquieroaca.com/api/matcher/brands/megatone/${megatoneBrandId}/exists`,
          {
            headers: { accept: '*/*' },
          },
        ),
      );

      return response.data.exists;
    } catch (error) {
      // si falla, asumimos que no existe
      return false;
    }
  }
}
