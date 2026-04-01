import { Injectable } from '@nestjs/common';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { FravegaImagesSyncConfigService } from './fravega-images-sync-config.service';

@Injectable()
export class SpacesService {
  private client?: S3Client;

  constructor(private readonly configService: FravegaImagesSyncConfigService) {}

  async uploadProductImage(
    sku: string,
    position: number,
    imageBuffer: Buffer,
  ): Promise<string> {
    const key = this.configService.buildSpacesObjectKey(sku, position);

    const upload = new Upload({
      client: this.getClient(),
      params: {
        Bucket: this.configService.spacesBucket,
        Key: key,
        Body: imageBuffer,
        ACL: 'public-read',
        ContentType: 'image/jpeg',
        CacheControl: 'public, max-age=31536000, immutable',
      },
    });

    await upload.done();

    return this.configService.buildSpacesCdnUrl(sku, position);
  }

  async productImageExists(sku: string, position: number): Promise<boolean> {
    try {
      await this.getClient().send(
        new HeadObjectCommand({
          Bucket: this.configService.spacesBucket,
          Key: this.configService.buildSpacesObjectKey(sku, position),
        }),
      );

      return true;
    } catch (error) {
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } })
        .$metadata?.httpStatusCode;

      if (statusCode === 404) {
        return false;
      }

      throw error;
    }
  }

  buildProductImageUrl(sku: string, position: number): string {
    return this.configService.buildSpacesCdnUrl(sku, position);
  }

  private getClient(): S3Client {
    if (!this.client) {
      this.client = new S3Client({
        region: this.configService.spacesRegion,
        endpoint: this.configService.spacesEndpoint,
        forcePathStyle: false,
        credentials: {
          accessKeyId: this.configService.spacesAccessKeyId,
          secretAccessKey: this.configService.spacesSecretAccessKey,
        },
      });
    }

    return this.client;
  }
}
