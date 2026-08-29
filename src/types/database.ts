export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type DocumentStatus =
  | "requested"
  | "assigned"
  | "in_progress"
  | "submitted"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "completed";

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          invite_code: string;
          owner_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          invite_code: string;
          owner_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["companies"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          company_id: string | null;
          display_name: string;
          job_title: string;
          level: number;
          money: number;
          created_at: string;
        };
        Insert: {
          id: string;
          company_id?: string | null;
          display_name: string;
          job_title?: string;
          level?: number;
          money?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          company_id: string;
          template_id: string;
          template_snapshot: Json;
          title: string;
          field_values: Json;
          status: DocumentStatus;
          requires_approval: boolean;
          created_by: string;
          assigned_to: string | null;
          approver_id: string | null;
          approval_note: string | null;
          due_at: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          template_id: string;
          template_snapshot: Json;
          title: string;
          field_values?: Json;
          status?: DocumentStatus;
          requires_approval?: boolean;
          created_by: string;
          assigned_to?: string | null;
          approver_id?: string | null;
          approval_note?: string | null;
          due_at?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
        Relationships: [];
      };
      document_events: {
        Row: {
          id: string;
          document_id: string;
          actor_id: string | null;
          event_type: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          actor_id?: string | null;
          event_type: string;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["document_events"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
