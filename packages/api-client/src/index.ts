export interface ApiClientOptions { baseUrl: string; token?: string; }

export class LifeOsApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
    if (this.options.token) headers.set('Authorization', `Bearer ${this.options.token}`);
    const response = await fetch(`${this.options.baseUrl.replace(/\/$/, '')}${path}`, { ...init, headers });
    if (!response.ok) throw new Error(`LifeOS API request failed: ${response.status}`);
    return response.json() as Promise<T>;
  }
}
