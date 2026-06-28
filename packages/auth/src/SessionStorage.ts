import type { SupportedStorage } from "@supabase/supabase-js";

export interface SecureKeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export class SecureStorageAdapter implements SupportedStorage {
  constructor(private readonly store: SecureKeyValueStore) {}

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.store.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    await this.store.delete(key);
  }
}
