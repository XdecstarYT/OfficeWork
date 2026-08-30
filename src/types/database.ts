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
          started: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          invite_code: string;
          owner_id: string;
          started?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["companies"]["Insert"]>;
        Relationships: [];
      };
      company_invite_codes: {
        Row: {
          id: string;
          company_id: string;
          code: string;
          label: string | null;
          job_title: string;
          level: number;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          code: string;
          label?: string | null;
          job_title?: string;
          level?: number;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["company_invite_codes"]["Insert"]>;
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
          join_code: string | null;
          email_handle: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          company_id?: string | null;
          display_name: string;
          job_title?: string;
          level?: number;
          money?: number;
          join_code?: string | null;
          email_handle?: string | null;
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
          payout_override: number | null;
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
          payout_override?: number | null;
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
      emails: {
        Row: {
          id: string;
          company_id: string;
          sender_id: string | null;
          sender_client_id: string | null;
          recipient_id: string | null;
          recipient_client_id: string | null;
          subject: string;
          body: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          sender_id?: string | null;
          sender_client_id?: string | null;
          recipient_id?: string | null;
          recipient_client_id?: string | null;
          subject: string;
          body: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["emails"]["Insert"]>;
        Relationships: [];
      };
      board_meetings: {
        Row: {
          id: string;
          company_id: string;
          title: string;
          agenda: string | null;
          scheduled_at: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          title: string;
          agenda?: string | null;
          scheduled_at: string;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["board_meetings"]["Insert"]>;
        Relationships: [];
      };
      board_meeting_rsvps: {
        Row: {
          id: string;
          meeting_id: string;
          user_id: string;
          status: "invited" | "attending" | "declined";
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          user_id: string;
          status?: "invited" | "attending" | "declined";
          responded_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["board_meeting_rsvps"]["Insert"]>;
        Relationships: [];
      };
      corporate_updates: {
        Row: {
          id: string;
          company_id: string;
          title: string;
          body: string;
          posted_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          title: string;
          body: string;
          posted_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["corporate_updates"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      resolve_invite_code: {
        Args: { p_code: string };
        Returns: { company_id: string; company_name: string; job_title: string; level: number }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
