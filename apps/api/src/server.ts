// TypeScript service boundary for the target LifeOS API/BFF architecture.
// The current production entrypoint remains server.js until the migration is completed.
export type ServiceName = 'identity' | 'life' | 'ai' | 'documents' | 'search' | 'memory';

export interface ServiceContext {
  requestId: string;
  userId?: string;
}

export interface LifeOsService {
  readonly name: ServiceName;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export const LIFEOS_SERVICES: ServiceName[] = [
  'identity', 'life', 'ai', 'documents', 'search', 'memory'
];
