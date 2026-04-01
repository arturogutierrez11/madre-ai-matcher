import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { FravegaImagesSyncConfigService } from './fravega-images-sync-config.service';

@Injectable()
export class ImageProcessorService {
  constructor(private readonly configService: FravegaImagesSyncConfigService) {}

  async normalizeToFravegaJpg(input: Buffer): Promise<Buffer> {
    const size = this.configService.targetImageSize;

    const output = await sharp(input)
      .flatten({ background: '#ffffff' })
      .resize(size, size, {
        fit: 'contain',
        background: '#ffffff',
        withoutEnlargement: false,
      })
      .jpeg({
        quality: this.configService.jpgQuality,
        chromaSubsampling: '4:4:4',
      })
      .toBuffer();

    const metadata = await sharp(output).metadata();

    if (metadata.width !== size || metadata.height !== size) {
      throw new Error(
        `Invalid processed image size ${metadata.width}x${metadata.height}. Expected ${size}x${size}.`,
      );
    }

    return output;
  }
}
