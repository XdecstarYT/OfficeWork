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
          salary_per_level: number;
          company_badges_claimed: string[];
          total_payroll_paid: number;
          parent_company_id: string | null;
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
          salary_per_level?: number;
          company_badges_claimed?: string[];
          total_payroll_paid?: number;
          parent_company_id?: string | null;
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
          bio: string | null;
          last_active_date: string | null;
          streak_count: number;
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
          bio?: string | null;
          last_active_date?: string | null;
          streak_count?: number;
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
          flagged: boolean;
          archived: boolean;
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
          flagged?: boolean;
          archived?: boolean;
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
          pinned: boolean;
          category: "announcement" | "policy" | "celebration" | "other";
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          title: string;
          body: string;
          posted_by: string;
          pinned?: boolean;
          category?: "announcement" | "policy" | "celebration" | "other";
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
      company_departments: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["company_departments"]["Insert"]>;
        Relationships: [];
      };
      performance_reviews: {
        Row: {
          id: string;
          company_id: string;
          member_id: string;
          reviewer_id: string;
          rating: number;
          comments: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          member_id: string;
          reviewer_id: string;
          rating: number;
          comments?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["performance_reviews"]["Insert"]>;
        Relationships: [];
      };
      time_off_requests: {
        Row: {
          id: string;
          company_id: string;
          member_id: string;
          start_date: string;
          end_date: string;
          reason: string;
          status: "pending" | "approved" | "denied";
          decided_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          member_id: string;
          start_date: string;
          end_date: string;
          reason?: string;
          status?: "pending" | "approved" | "denied";
          decided_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["time_off_requests"]["Insert"]>;
        Relationships: [];
      };
      client_contracts: {
        Row: {
          id: string;
          company_id: string;
          client_id: string;
          title: string;
          total_tasks: number;
          completed_tasks: number;
          bonus_payout: number;
          status: "active" | "completed";
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          client_id: string;
          title: string;
          total_tasks: number;
          completed_tasks?: number;
          bonus_payout?: number;
          status?: "active" | "completed";
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["client_contracts"]["Insert"]>;
        Relationships: [];
      };
      stock_holdings: {
        Row: {
          id: string;
          member_id: string;
          symbol: string;
          shares: number;
          avg_cost: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          symbol: string;
          shares?: number;
          avg_cost?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stock_holdings"]["Insert"]>;
        Relationships: [];
      };
      stock_transactions: {
        Row: {
          id: string;
          company_id: string | null;
          member_id: string;
          symbol: string;
          side: "buy" | "sell";
          shares: number;
          price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          member_id: string;
          symbol: string;
          side: "buy" | "sell";
          shares: number;
          price: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stock_transactions"]["Insert"]>;
        Relationships: [];
      };
      company_equipment: {
        Row: {
          id: string;
          company_id: string;
          item_key: string;
          purchased_by: string;
          purchased_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          item_key: string;
          purchased_by: string;
          purchased_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["company_equipment"]["Insert"]>;
        Relationships: [];
      };
      company_chat_messages: {
        Row: {
          id: string;
          company_id: string;
          sender_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          sender_id: string;
          body: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["company_chat_messages"]["Insert"]>;
        Relationships: [];
      };
      corporate_update_reactions: {
        Row: {
          id: string;
          update_id: string;
          member_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          update_id: string;
          member_id: string;
          emoji: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["corporate_update_reactions"]["Insert"]>;
        Relationships: [];
      };
      member_moods: {
        Row: {
          member_id: string;
          company_id: string;
          emoji: string;
          updated_at: string;
        };
        Insert: {
          member_id: string;
          company_id: string;
          emoji: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["member_moods"]["Insert"]>;
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
      check_company_badges: {
        Args: Record<string, never>;
        Returns: string[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
