export interface UserRef { id: string; email: string; name: string; }

export interface MemoryRef {
  id: string;
  userId: string;
  title: string;
  caption?: string;
  place?: string;
  date: string;
  mediaUrl?: string;
  source?: string;
}

export interface SearchQuery { q?: string; from?: string; to?: string; person?: string; place?: string; tag?: string; }

export interface ProviderStatus { provider: string; configured: boolean; reachable?: boolean; }
