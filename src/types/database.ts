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
          current_day: number;
          day_status: "not_started" | "active" | "ended";
          day_started_at: string | null;
          career_mode: boolean;
          emoji: string;
          motto: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          invite_code: string;
          owner_id: string;
          started?: boolean;
          current_day?: number;
          day_status?: "not_started" | "active" | "ended";
          day_started_at?: string | null;
          career_mode?: boolean;
          emoji?: string;
          motto?: string | null;
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
          xp: number;
          join_code: string | null;
          email_handle: string | null;
          department: string | null;
          claimed_milestones: string[];
          created_at: string;
        };
        Insert: {
          id: string;
          company_id?: string | null;
          display_name: string;
          job_title?: string;
          level?: number;
          money?: number;
          xp?: number;
          join_code?: string | null;
          email_handle?: string | null;
          department?: string | null;
          claimed_milestones?: string[];
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
          assigned_to_npc_id: string | null;
          approver_id: string | null;
          approval_note: string | null;
          due_at: string | null;
          payout_override: number | null;
          reference_data: Json;
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
          assigned_to_npc_id?: string | null;
          approver_id?: string | null;
          approval_note?: string | null;
          due_at?: string | null;
          payout_override?: number | null;
          reference_data?: Json;
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
          sender_npc_id: string | null;
          recipient_id: string | null;
          recipient_client_id: string | null;
          recipient_npc_id: string | null;
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
          sender_npc_id?: string | null;
          recipient_id?: string | null;
          recipient_client_id?: string | null;
          recipient_npc_id?: string | null;
          subject: string;
          body: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["emails"]["Insert"]>;
        Relationships: [];
      };
      company_npcs: {
        Row: {
          id: string;
          company_id: string;
          persona_key: string | null;
          custom_persona_id: string | null;
          job_title: string;
          level: number;
          hired_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          persona_key?: string | null;
          custom_persona_id?: string | null;
          job_title: string;
          level?: number;
          hired_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["company_npcs"]["Insert"]>;
        Relationships: [];
      };
      custom_npc_personas: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          avatar: string;
          personality: string;
          job_title: string;
          level: number;
          hire_cost: number;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          avatar?: string;
          personality?: string;
          job_title?: string;
          level?: number;
          hire_cost?: number;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["custom_npc_personas"]["Insert"]>;
        Relationships: [];
      };
      custom_ai_clients: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          company_name: string;
          avatar: string;
          personality: string;
          category_affinity: string[];
          payout_min: number;
          payout_max: number;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          company_name?: string;
          avatar?: string;
          personality?: string;
          category_affinity?: string[];
          payout_min?: number;
          payout_max?: number;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["custom_ai_clients"]["Insert"]>;
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
      custom_templates: {
        Row: {
          id: string;
          company_id: string;
          created_by: string;
          template: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          created_by: string;
          template: unknown;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["custom_templates"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      resolve_invite_code: {
        Args: { p_code: string };
        Returns: { company_id: string; company_name: string; job_title: string; level: number }[];
      };
      kick_member: {
        Args: { p_member_id: string };
        Returns: void;
      };
      claim_milestone: {
        Args: { p_milestone_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
