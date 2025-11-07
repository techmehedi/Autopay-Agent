export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
          updated_at: string;
          owner_id: string;
          locus_client_id: string | null;
          locus_client_secret: string | null;
          locus_mcp_url: string | null;
          settings: Json;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
          updated_at?: string;
          owner_id: string;
          locus_client_id?: string | null;
          locus_client_secret?: string | null;
          locus_mcp_url?: string | null;
          settings?: Json;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          created_at?: string;
          updated_at?: string;
          owner_id?: string;
          locus_client_id?: string | null;
          locus_client_secret?: string | null;
          locus_mcp_url?: string | null;
          settings?: Json;
        };
      };
      employees: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          email: string;
          name: string;
          wallet_address: string | null;
          status: 'active' | 'inactive';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id?: string | null;
          email: string;
          name: string;
          wallet_address?: string | null;
          status?: 'active' | 'inactive';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string | null;
          email?: string;
          name?: string;
          wallet_address?: string | null;
          status?: 'active' | 'inactive';
          created_at?: string;
          updated_at?: string;
        };
      };
      claims: {
        Row: {
          id: string;
          organization_id: string;
          employee_id: string;
          amount: number;
          currency: string;
          purpose: string;
          recipient: string | null;
          status: 'pending' | 'approved' | 'rejected' | 'paid';
          decision: 'approve' | 'deny' | 'review' | null;
          confidence: number | null;
          reason: string | null;
          tx_id: string | null;
          trace_id: string | null;
          explanations: Json | null;
          created_at: string;
          updated_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          employee_id: string;
          amount: number;
          currency?: string;
          purpose: string;
          recipient?: string | null;
          status?: 'pending' | 'approved' | 'rejected' | 'paid';
          decision?: 'approve' | 'deny' | 'review' | null;
          confidence?: number | null;
          reason?: string | null;
          tx_id?: string | null;
          trace_id?: string | null;
          explanations?: Json | null;
          created_at?: string;
          updated_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          employee_id?: string;
          amount?: number;
          currency?: string;
          purpose?: string;
          recipient?: string | null;
          status?: 'pending' | 'approved' | 'rejected' | 'paid';
          decision?: 'approve' | 'deny' | 'review' | null;
          confidence?: number | null;
          reason?: string | null;
          tx_id?: string | null;
          trace_id?: string | null;
          explanations?: Json | null;
          created_at?: string;
          updated_at?: string;
          processed_at?: string | null;
        };
      };
      policies: {
        Row: {
          id: string;
          organization_id: string;
          per_txn_max: number;
          daily_max: number;
          monthly_max: number | null;
          whitelisted_contacts: string[];
          default_contact: string | null;
          auto_approve: boolean;
          require_approval: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          per_txn_max: number;
          daily_max: number;
          monthly_max?: number | null;
          whitelisted_contacts?: string[];
          default_contact?: string | null;
          auto_approve?: boolean;
          require_approval?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          per_txn_max?: number;
          daily_max?: number;
          monthly_max?: number | null;
          whitelisted_contacts?: string[];
          default_contact?: string | null;
          auto_approve?: boolean;
          require_approval?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: 'owner' | 'admin' | 'member';
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: 'owner' | 'admin' | 'member';
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: 'owner' | 'admin' | 'member';
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

