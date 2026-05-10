export interface DetectorCheck {
  name: string;
  passed: boolean;
  partial: boolean;
  detail: string;
}

export interface DetectorResult {
  active: boolean;
  confidence: number;
  pattern: string;
  direction: 'over' | 'under';
  message: string;
  market: string[];
  checks: DetectorCheck[];
}

export interface DetectorState {
  values: number[];
  rsi: (number | null)[];
  bands: {
    upper: (number | null)[];
    middle: (number | null)[];
    lower: (number | null)[];
  };
  mom: (number | null)[];
  mm9: (number | null)[];
  mm21: (number | null)[];
}
