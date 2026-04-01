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

  @Get('run')
  run(
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
    @Query('refIds') refIds?: string,
    @Query('skus') skus?: string,
    @Query('dryRun') dryRun?: string,
  ) {
    const refIdsParam = refIds ?? skus;

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
  ) {
    const input: SyncAllFravegaProductImagesInput = {
      startOffset: startOffset
        ? Number(startOffset)
        : offset
          ? Number(offset)
          : 0,
      limit: limit ? Number(limit) : 100,
      dryRun: dryRun === 'true',
      maxBatches: maxBatches ? Number(maxBatches) : undefined,
    };

    return this.syncFravegaProductImagesUseCase.executeAll(input);
  }
}
