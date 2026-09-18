/**
 * Global Deno and remote module type declarations for IDE TypeScript language service.
 * Enables clean editing of Supabase Edge Functions without requiring global Deno tooling.
 */

declare namespace Deno {
  export const env: {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    toObject(): Record<string, string>;
  };
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function createClient<T = any>(supabaseUrl: string, supabaseKey: string, options?: any): any;
}

declare module "https://*" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyModule: any;
  export default anyModule;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const serve: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const createClient: any;
}
