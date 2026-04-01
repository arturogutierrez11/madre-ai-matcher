import { Injectable, Logger } from '@nestjs/common';
import {
  SyncAllFravegaProductImagesInput,
  SyncAllFravegaProductImagesResult,
  SyncFravegaProductImagesUseCase,
} from 'src/application/use-case/sync-fravega-product-images.usecase';

type RunnerStatus = 'idle' | 'running' | 'completed' | 'failed';

@Injectable()
export class FravegaImagesSyncRunnerService {
  private readonly logger = new Logger(FravegaImagesSyncRunnerService.name);

  private status: RunnerStatus = 'idle';
  private startedAt?: string;
  private finishedAt?: string;
  private lastInput?: SyncAllFravegaProductImagesInput;
  private lastResult?: SyncAllFravegaProductImagesResult;
  private lastError?: string;

  constructor(
    private readonly syncFravegaProductImagesUseCase: SyncFravegaProductImagesUseCase,
  ) {}

  start(input: SyncAllFravegaProductImagesInput) {
    if (this.status === 'running') {
      return {
        started: false,
        reason: 'already_running',
        status: this.getStatus(),
      };
    }

    this.status = 'running';
    this.startedAt = new Date().toISOString();
    this.finishedAt = undefined;
    this.lastInput = input;
    this.lastResult = undefined;
    this.lastError = undefined;

    void this.runInBackground(input);

    return {
      started: true,
      status: this.getStatus(),
    };
  }

  getStatus() {
    return {
      status: this.status,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      input: this.lastInput,
      result: this.lastResult,
      error: this.lastError,
    };
  }

  private async runInBackground(input: SyncAllFravegaProductImagesInput) {
    try {
      this.logger.log(
        `Starting background Fravega images sync with input=${JSON.stringify(input)}`,
      );

      this.lastResult =
        await this.syncFravegaProductImagesUseCase.executeAll(input);

      this.status = 'completed';
      this.finishedAt = new Date().toISOString();

      this.logger.log('Background Fravega images sync completed');
    } catch (error) {
      this.status = 'failed';
      this.finishedAt = new Date().toISOString();
      this.lastError =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error);

      this.logger.error(
        `Background Fravega images sync failed: ${this.lastError}`,
      );
    }
  }
}
