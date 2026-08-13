export interface ShotScopeSummary {
  shots: number;
  putts?: number;
  sgTee?: number;
  sgApproach?: number;
  sgShort?: number;
  sgPutting?: number;
}

export interface RoundSummary {
  id: string;
  date: string;
  course: string;
  total: number;
  holeCount: number;
  front9: number;
  back9: number;
  holes: number[];
  complete: boolean;
  shotScope?: ShotScopeSummary;
}
