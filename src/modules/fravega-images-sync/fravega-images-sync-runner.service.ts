import { Injectable, Logger } from '@nestjs/common';
import {
  SyncAllFravegaProductImagesInput,
  SyncAllFravegaProductImagesProgress,
  SyncAllFravegaProductImagesResult,
  SyncFravegaProductImagesUseCase,
} from 'src/application/use-case/sync-fravega-product-images.usecase';

type RunnerStatus = 'idle' | 'running' | 'completed' | 'failed';

@Injectable()
export class FravegaImagesSyncRunnerService {
  private readonly logger = new Logger(FravegaImagesSyncRunnerService.name);
  private readonly cycleDelayMs = 2000;

  private status: RunnerStatus = 'idle';
  private startedAt?: string;
  private finishedAt?: string;
  private lastInput?: SyncAllFravegaProductImagesInput;
  private lastResult?: SyncAllFravegaProductImagesResult;
  private lastError?: string;
  private cycle = 0;
  private progress?: SyncAllFravegaProductImagesProgress;

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
    this.cycle = 0;
    this.progress = undefined;

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
      cycle: this.cycle,
      input: this.lastInput,
      progress: this.progress,
      result: this.lastResult,
      error: this.lastError,
    };
  }

  private async runInBackground(input: SyncAllFravegaProductImagesInput) {
    try {
      this.logger.log(
        `Starting background Fravega images sync with input=${JSON.stringify(input)}`,
      );

      while (true) {
        this.cycle += 1;
        this.progress = {
          phase: 'resolving-last-offset',
          message: `Starting cycle ${this.cycle}`,
        };

        this.logger.log(`Starting sync cycle ${this.cycle}`);

        this.lastResult = await this.syncFravegaProductImagesUseCase.executeAll(
          {
            ...input,
            onProgress: (progress) => {
              this.progress = progress;

              if (progress.message) {
                this.logger.log(
                  `Cycle ${this.cycle} progress: ${progress.message}`,
                );
              }
            },
          },
        );

        this.progress = {
          phase: 'completed-cycle',
          batch: this.lastResult.batches,
          totalRequested: this.lastResult.totalRequested,
          processed: this.lastResult.processed,
          skipped: this.lastResult.skipped,
          failed: this.lastResult.failed,
          currentOffset: this.lastResult.nextOffset,
          message: `Cycle ${this.cycle} completed`,
        };

        const noPendingWork =
          this.lastResult.processed === 0 && this.lastResult.failed === 0;

        if (noPendingWork) {
          break;
        }

        this.logger.log(
          `Cycle ${this.cycle} finished with processed=${this.lastResult.processed} failed=${this.lastResult.failed}. Restarting in ${this.cycleDelayMs}ms.`,
        );

        await this.delay(this.cycleDelayMs);
      }

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

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
