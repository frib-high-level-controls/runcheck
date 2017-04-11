// Type definitions for cas-client.js

interface CasOptions {
  base_url: string;
  service: string;
  version: number;
}

export function create(options: CasOptions): void;
