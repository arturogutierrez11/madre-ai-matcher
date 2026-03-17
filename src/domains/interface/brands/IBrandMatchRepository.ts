export interface IBrandMatchRepository {
  saveMatch(data: {
    meliBrand: string;
    fravegaBrandId: string;
    fravegaBrandName: string;
    confidence: number;
  }): Promise<any>;

  existsByMeliBrand(meliBrand: string): Promise<boolean>;
}
