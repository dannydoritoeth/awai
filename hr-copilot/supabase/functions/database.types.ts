/**
 * Stub Database type definitions for Supabase Edge Functions.
 * Replace with actual generated types by running:
 *   supabase gen types typescript --local > supabase/functions/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export interface Database {
  public: {
    Tables: {
      [tableName: string]: {
        Row: any;
        Insert: any;
        Update: any;
      };
    };
    Views: {
      [viewName: string]: {
        Row: any;
      };
    };
    Functions: {
      [fnName: string]: {
        Args: any;
        Returns: any;
      };
    };
  };
}
