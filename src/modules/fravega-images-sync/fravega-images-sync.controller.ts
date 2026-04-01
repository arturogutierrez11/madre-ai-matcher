import { Controller, Get, Query } from '@nestjs/common';
import {
  SyncAllFravegaProductImagesInput,
  SyncFravegaProductImagesInput,
  SyncFravegaProductImagesUseCase,
} from 'src/application/use-case/sync-fravega-product-images.usecase';
import { FravegaImagesSyncRunnerService } from './fravega-images-sync-runner.service';

@Controller('fravega-images-sync')
export class FravegaImagesSyncController {
  constructor(
    private readonly syncFravegaProductImagesUseCase: SyncFravegaProductImagesUseCase,
    private readonly fravegaImagesSyncRunnerService: FravegaImagesSyncRunnerService,
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
    @Query('fromEnd') fromEnd?: string,
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
      fromEnd: fromEnd === 'true',
    };

    return this.syncFravegaProductImagesUseCase.executeAll(input);
  }

  @Get('run-all-background')
  runAllBackground(
    @Query('startOffset') startOffset?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
    @Query('dryRun') dryRun?: string,
    @Query('maxBatches') maxBatches?: string,
    @Query('turbo') turbo?: string,
    @Query('fast') fast?: string,
    @Query('fromEnd') fromEnd?: string,
  ) {
    const input = this.buildRunAllInput({
      startOffset,
      offset,
      limit,
      dryRun,
      maxBatches,
      turbo,
      fast,
      fromEnd,
    });

    return this.fravegaImagesSyncRunnerService.start(input);
  }

  @Get('run-all-status')
  runAllStatus() {
    return this.fravegaImagesSyncRunnerService.getStatus();
  }

  private buildRunAllInput(params: {
    startOffset?: string;
    offset?: string;
    limit?: string;
    dryRun?: string;
    maxBatches?: string;
    turbo?: string;
    fast?: string;
    fromEnd?: string;
  }): SyncAllFravegaProductImagesInput {
    const turboEnabled = params.turbo === 'true';
    const fastEnabled = params.fast === 'true';
    const speedConfig = fastEnabled ? this.fastConfig : this.turboConfig;

    return {
      startOffset: params.startOffset
        ? Number(params.startOffset)
        : params.offset
          ? Number(params.offset)
          : 0,
      limit: params.limit
        ? Number(params.limit)
        : turboEnabled || fastEnabled
          ? speedConfig.limit
          : 100,
      dryRun: params.dryRun === 'true',
      maxBatches: params.maxBatches ? Number(params.maxBatches) : undefined,
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
      fromEnd: params.fromEnd === 'true',
    };
  }
}
