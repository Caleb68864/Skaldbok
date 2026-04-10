export type ID = string;

export interface Timestamped {
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface Versioned {
  schemaVersion: number;
}
