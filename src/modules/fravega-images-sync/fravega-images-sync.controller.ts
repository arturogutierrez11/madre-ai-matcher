import { Controller, Get, Query } from '@nestjs/common';
import {
  SyncAllFravegaProductImagesInput,
  SyncFravegaProductImagesInput,
  SyncFravegaProductImagesUseCase,
} from 'src/application/use-case/sync-fravega-product-images.usecase';

@Controller('fravega-images-sync')
export class FravegaImagesSyncController {
  constructor(
    private readonly syncFravegaProductImagesUseCase: SyncFravegaProductImagesUseCase,
  ) {}

  private readonly turboConfig = {
    limit: 250,
    batchConcurrency: 12,
    perProductImageConcurrency: 5,
  };

  private readonly fastConfig = {
    limit: 400,
    batchConcurrency: 20,
    perProductImageConcurrency: 5,
    maxImagesPerProduct: 2,
    skipExistingUploadChecks: true,
  };

  @Get('run')
  run(
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
    @Query('refIds') refIds?: string,
    @Query('skus') skus?: string,
    @Query('dryRun') dryRun?: string,
    @Query('turbo') turbo?: string,
    @Query('fast') fast?: string,
  ) {
    const refIdsParam = refIds ?? skus;
    const turboEnabled = turbo === 'true';
    const fastEnabled = fast === 'true';
    const speedConfig = fastEnabled ? this.fastConfig : this.turboConfig;

    const input: SyncFravegaProductImagesInput = {
      offset: offset ? Number(offset) : 0,
      limit: limit ? Number(limit) : 100,
      refIds: refIdsParam
        ? refIdsParam
            .split(',')
            .map((refId) => refId.trim())
            .filter(Boolean)
        : undefined,
      dryRun: dryRun === 'true',
      batchConcurrency:
        turboEnabled || fastEnabled ? speedConfig.batchConcurrency : undefined,
      perProductImageConcurrency:
        turboEnabled || fastEnabled
          ? speedConfig.perProductImageConcurrency
          : undefined,
      maxImagesPerProduct: fastEnabled
        ? this.fastConfig.maxImagesPerProduct
        : undefined,
      skipExistingUploadChecks: fastEnabled
        ? this.fastConfig.skipExistingUploadChecks
        : undefined,
    };

    return this.syncFravegaProductImagesUseCase.execute(input);
  }

  @Get('run-all')
  runAll(
    @Query('startOffset') startOffset?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
    @Query('dryRun') dryRun?: string,
    @Query('maxBatches') maxBatches?: string,
    @Query('turbo') turbo?: string,
    @Query('fast') fast?: string,
  ) {
    const turboEnabled = turbo === 'true';
    const fastEnabled = fast === 'true';
    const speedConfig = fastEnabled ? this.fastConfig : this.turboConfig;

    const input: SyncAllFravegaProductImagesInput = {
      startOffset: startOffset
        ? Number(startOffset)
        : offset
          ? Number(offset)
          : 0,
      limit: limit
        ? Number(limit)
        : turboEnabled || fastEnabled
          ? speedConfig.limit
          : 100,
      dryRun: dryRun === 'true',
      maxBatches: maxBatches ? Number(maxBatches) : undefined,
      batchConcurrency:
        turboEnabled || fastEnabled ? speedConfig.batchConcurrency : undefined,
      perProductImageConcurrency:
        turboEnabled || fastEnabled
          ? speedConfig.perProductImageConcurrency
          : undefined,
      maxImagesPerProduct: fastEnabled
        ? this.fastConfig.maxImagesPerProduct
        : undefined,
      skipExistingUploadChecks: fastEnabled
        ? this.fastConfig.skipExistingUploadChecks
        : undefined,
    };

    return this.syncFravegaProductImagesUseCase.executeAll(input);
  }
}
