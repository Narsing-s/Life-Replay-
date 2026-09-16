export interface ApiConfig {
  port: number;
  environment: string;
  frontendUrl: string;
  databaseUrl: string;
  redisUrl: string;
}

export function loadConfig(env = process.env): ApiConfig {
  return {
    port: Number(env.PORT || 4173),
    environment: env.NODE_ENV || 'development',
    frontendUrl: env.FRONTEND_URL || 'http://localhost:4173',
    databaseUrl: env.DATABASE_URL || '',
    redisUrl: env.REDIS_URL || ''
  };
}
