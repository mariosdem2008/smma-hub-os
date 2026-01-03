export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_type: string
          actor_agency_member: string | null
          actor_client_user: string | null
          created_at: string
          details: Json | null
          id: string
          project_id: string
        }
        Insert: {
          action_type: string
          actor_agency_member?: string | null
          actor_client_user?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          project_id: string
        }
        Update: {
          action_type?: string
          actor_agency_member?: string | null
          actor_client_user?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_agency_member_fkey"
            columns: ["actor_agency_member"]
            isOneToOne: false
            referencedRelation: "agency_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_actor_client_user_fkey"
            columns: ["actor_client_user"]
            isOneToOne: false
            referencedRelation: "client_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_accounts: {
        Row: {
          account_name: string | null
          agency_id: string
          client_id: string
          created_at: string
          currency: string | null
          id: string
          meta_ad_account_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          agency_id: string
          client_id: string
          created_at?: string
          currency?: string | null
          id?: string
          meta_ad_account_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          agency_id?: string
          client_id?: string
          created_at?: string
          currency?: string | null
          id?: string
          meta_ad_account_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_accounts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ad_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_campaigns: {
        Row: {
          ad_account_id: string
          created_at: string
          daily_budget: number | null
          id: string
          lifetime_budget: number | null
          meta_campaign_id: string
          name: string
          objective: string | null
          start_time: string | null
          status: string | null
          stop_time: string | null
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          created_at?: string
          daily_budget?: number | null
          id?: string
          lifetime_budget?: number | null
          meta_campaign_id: string
          name: string
          objective?: string | null
          start_time?: string | null
          status?: string | null
          stop_time?: string | null
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          created_at?: string
          daily_budget?: number | null
          id?: string
          lifetime_budget?: number | null
          meta_campaign_id?: string
          name?: string
          objective?: string | null
          start_time?: string | null
          status?: string | null
          stop_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_insights: {
        Row: {
          ad_campaign_id: string
          clicks: number | null
          conversions: number | null
          cost_per_conversion: number | null
          cpc: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          date: string
          id: string
          impressions: number | null
          reach: number | null
          spend: number | null
        }
        Insert: {
          ad_campaign_id: string
          clicks?: number | null
          conversions?: number | null
          cost_per_conversion?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          date: string
          id?: string
          impressions?: number | null
          reach?: number | null
          spend?: number | null
        }
        Update: {
          ad_campaign_id?: string
          clicks?: number | null
          conversions?: number | null
          cost_per_conversion?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          date?: string
          id?: string
          impressions?: number | null
          reach?: number | null
          spend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_insights_ad_campaign_id_fkey"
            columns: ["ad_campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      agencies: {
        Row: {
          created_at: string
          id: string
          name: string
          niche: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          niche?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          niche?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      agency_ai_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          meta_json: Json
          role: string
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          meta_json?: Json
          role: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          meta_json?: Json
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_ai_chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "agency_ai_chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_ai_chat_threads: {
        Row: {
          agency_id: string
          created_at: string
          created_by: string
          id: string
          kind: string
          title: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          created_by: string
          id?: string
          kind?: string
          title?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_ai_chat_threads_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_brains: {
        Row: {
          agency_id: string
          brain_json: Json
          calibration_state: Json | null
          confidence: number
          created_at: string
          id: string
          json_diff: Json | null
          locked: boolean
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          agency_id: string
          brain_json: Json
          calibration_state?: Json | null
          confidence?: number
          created_at?: string
          id?: string
          json_diff?: Json | null
          locked?: boolean
          status: string
          updated_at?: string
          version: number
        }
        Update: {
          agency_id?: string
          brain_json?: Json
          calibration_state?: Json | null
          confidence?: number
          created_at?: string
          id?: string
          json_diff?: Json | null
          locked?: boolean
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "agency_brains_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_invite_email_logs: {
        Row: {
          agency_id: string
          id: string
          invite_id: string
          inviter_user_id: string
          ip: string | null
          sent_at: string
          to_email: string
          user_agent: string | null
        }
        Insert: {
          agency_id: string
          id?: string
          invite_id: string
          inviter_user_id: string
          ip?: string | null
          sent_at?: string
          to_email: string
          user_agent?: string | null
        }
        Update: {
          agency_id?: string
          id?: string
          invite_id?: string
          inviter_user_id?: string
          ip?: string | null
          sent_at?: string
          to_email?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_invite_email_logs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_invite_email_logs_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "agency_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_invites: {
        Row: {
          accepted: boolean
          accepted_at: string | null
          agency_id: string
          created_at: string
          declined: boolean
          declined_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: string
          token: string | null
        }
        Insert: {
          accepted?: boolean
          accepted_at?: string | null
          agency_id: string
          created_at?: string
          declined?: boolean
          declined_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          token?: string | null
        }
        Update: {
          accepted?: boolean
          accepted_at?: string | null
          agency_id?: string
          created_at?: string
          declined?: boolean
          declined_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_invites_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_members: {
        Row: {
          accepted_at: string | null
          agency_id: string
          created_at: string
          id: string
          invited_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          agency_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          agency_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_members_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_onboarding_sessions: {
        Row: {
          agency_id: string
          answers_json: Json
          brain_id: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          step_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_id: string
          answers_json?: Json
          brain_id?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          step_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_id?: string
          answers_json?: Json
          brain_id?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          step_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_onboarding_sessions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_budgets: {
        Row: {
          agency_id: string
          budget_usd: number
          created_at: string
          hard_stop: boolean
          id: string
          month_yyyy_mm: string
          reset_day: number
          reset_time_utc: string
          reset_timezone: string
          spent_usd: number
          updated_at: string
        }
        Insert: {
          agency_id: string
          budget_usd?: number
          created_at?: string
          hard_stop?: boolean
          id?: string
          month_yyyy_mm: string
          reset_day?: number
          reset_time_utc?: string
          reset_timezone?: string
          spent_usd?: number
          updated_at?: string
        }
        Update: {
          agency_id?: string
          budget_usd?: number
          created_at?: string
          hard_stop?: boolean
          id?: string
          month_yyyy_mm?: string
          reset_day?: number
          reset_time_utc?: string
          reset_timezone?: string
          spent_usd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_budgets_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_document_chunks: {
        Row: {
          chunk_index: number
          chunk_meta: Json | null
          chunk_text: string
          created_at: string
          document_id: string
          id: string
          token_count: number
        }
        Insert: {
          chunk_index: number
          chunk_meta?: Json | null
          chunk_text: string
          created_at?: string
          document_id: string
          id?: string
          token_count: number
        }
        Update: {
          chunk_index?: number
          chunk_meta?: Json | null
          chunk_text?: string
          created_at?: string
          document_id?: string
          id?: string
          token_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "ai_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_documents: {
        Row: {
          agency_id: string
          client_id: string | null
          content: string
          created_at: string
          doc_type: string
          extracted_text: string | null
          file_name: string | null
          file_ref: string | null
          file_size_mb: number | null
          id: string
          metadata: Json | null
          mime_type: string | null
          source: Json
          source_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          client_id?: string | null
          content: string
          created_at?: string
          doc_type: string
          extracted_text?: string | null
          file_name?: string | null
          file_ref?: string | null
          file_size_mb?: number | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          source: Json
          source_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          client_id?: string | null
          content?: string
          created_at?: string
          doc_type?: string
          extracted_text?: string | null
          file_name?: string | null
          file_ref?: string | null
          file_size_mb?: number | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          source?: Json
          source_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_documents_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ai_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_embeddings: {
        Row: {
          agency_id: string
          chunk_id: string
          client_id: string | null
          created_at: string
          doc_type: string
          document_id: string
          embedding: string
          id: string
          metadata: Json | null
          model: string
        }
        Insert: {
          agency_id: string
          chunk_id: string
          client_id?: string | null
          created_at?: string
          doc_type: string
          document_id: string
          embedding: string
          id?: string
          metadata?: Json | null
          model: string
        }
        Update: {
          agency_id?: string
          chunk_id?: string
          client_id?: string | null
          created_at?: string
          doc_type?: string
          document_id?: string
          embedding?: string
          id?: string
          metadata?: Json | null
          model?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_embeddings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_embeddings_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "ai_document_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_embeddings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ai_embeddings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_embeddings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_embeddings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_embeddings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_embeddings_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "ai_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_escalations: {
        Row: {
          agency_id: string
          assignee_role: string
          client_id: string | null
          created_at: string
          id: string
          question: string
          reason: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agency_id: string
          assignee_role?: string
          client_id?: string | null
          created_at?: string
          id?: string
          question: string
          reason: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agency_id?: string
          assignee_role?: string
          client_id?: string | null
          created_at?: string
          id?: string
          question?: string
          reason?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_escalations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_escalations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ai_escalations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_escalations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_escalations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_escalations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generation_usage: {
        Row: {
          agency_id: string
          created_at: string | null
          generation_type: string
          id: string
          month_year: string
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string | null
          generation_type: string
          id?: string
          month_year: string
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string | null
          generation_type?: string
          id?: string
          month_year?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_agency"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_history: {
        Row: {
          agency_id: string
          client_id: string
          created_at: string
          id: string
          input: Json
          mode: string
          output: Json
          project_id: string | null
        }
        Insert: {
          agency_id: string
          client_id: string
          created_at?: string
          id?: string
          input?: Json
          mode: string
          output?: Json
          project_id?: string | null
        }
        Update: {
          agency_id?: string
          client_id?: string
          created_at?: string
          id?: string
          input?: Json
          mode?: string
          output?: Json
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_history_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ai_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_memory_items: {
        Row: {
          agency_id: string
          client_id: string | null
          content: string
          created_at: string
          id: string
          metadata: Json | null
          type: string
        }
        Insert: {
          agency_id: string
          client_id?: string | null
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          type: string
        }
        Update: {
          agency_id?: string
          client_id?: string | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_memory_items_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_memory_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ai_memory_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_memory_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_memory_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_memory_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_registry: {
        Row: {
          created_at: string
          id: string
          max_tokens: number
          model: string
          name: string
          notes: string | null
          status: string
          task_type: string
          template: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          max_tokens: number
          model: string
          name: string
          notes?: string | null
          status: string
          task_type: string
          template: string
          version: number
        }
        Update: {
          created_at?: string
          id?: string
          max_tokens?: number
          model?: string
          name?: string
          notes?: string | null
          status?: string
          task_type?: string
          template?: string
          version?: number
        }
        Relationships: []
      }
      ai_rate_limits: {
        Row: {
          agency_id: string
          created_at: string
          day_yyyy_mm_dd: string
          id: string
          limit_per_day: number
          reset_time_utc: string
          reset_timezone: string
          updated_at: string
          used_count: number
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          day_yyyy_mm_dd: string
          id?: string
          limit_per_day?: number
          reset_time_utc?: string
          reset_timezone?: string
          updated_at?: string
          used_count?: number
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          day_yyyy_mm_dd?: string
          id?: string
          limit_per_day?: number
          reset_time_utc?: string
          reset_timezone?: string
          updated_at?: string
          used_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_rate_limits_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_runs: {
        Row: {
          agency_id: string
          citations: Json
          client_id: string | null
          cost_usd: number
          created_at: string
          escalate_to_human: boolean
          escalation_reason: string | null
          id: string
          latency_ms: number
          metadata: Json | null
          model: string
          prompt_id: string | null
          prompt_version: number | null
          success: boolean
          tokens_in: number
          tokens_out: number
          unknown: boolean
          user_id: string | null
        }
        Insert: {
          agency_id: string
          citations: Json
          client_id?: string | null
          cost_usd: number
          created_at?: string
          escalate_to_human: boolean
          escalation_reason?: string | null
          id?: string
          latency_ms: number
          metadata?: Json | null
          model: string
          prompt_id?: string | null
          prompt_version?: number | null
          success: boolean
          tokens_in: number
          tokens_out: number
          unknown: boolean
          user_id?: string | null
        }
        Update: {
          agency_id?: string
          citations?: Json
          client_id?: string | null
          cost_usd?: number
          created_at?: string
          escalate_to_human?: boolean
          escalation_reason?: string | null
          id?: string
          latency_ms?: number
          metadata?: Json | null
          model?: string
          prompt_id?: string | null
          prompt_version?: number | null
          success?: boolean
          tokens_in?: number
          tokens_out?: number
          unknown?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ai_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "ai_prompt_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          agency_id: string
          client_id: string | null
          created_at: string
          endpoint: string
          error_code: string | null
          id: string
          latency_ms: number | null
          model: string | null
          status_code: number | null
          tokens_estimate: number | null
          tokens_in: number | null
          tokens_out: number | null
          unknown: boolean | null
        }
        Insert: {
          agency_id: string
          client_id?: string | null
          created_at?: string
          endpoint: string
          error_code?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          status_code?: number | null
          tokens_estimate?: number | null
          tokens_in?: number | null
          tokens_out?: number | null
          unknown?: boolean | null
        }
        Update: {
          agency_id?: string
          client_id?: string | null
          created_at?: string
          endpoint?: string
          error_code?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          status_code?: number | null
          tokens_estimate?: number | null
          tokens_in?: number | null
          tokens_out?: number | null
          unknown?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ai_usage_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_tasks: {
        Row: {
          approver_id: string
          asset_version_id: string
          comments: Json | null
          created_at: string
          id: string
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
        }
        Insert: {
          approver_id: string
          asset_version_id: string
          comments?: Json | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Update: {
          approver_id?: string
          asset_version_id?: string
          comments?: Json | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_tasks_asset_version_id_fkey"
            columns: ["asset_version_id"]
            isOneToOne: false
            referencedRelation: "asset_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_comments: {
        Row: {
          asset_id: string
          comment: string
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          asset_id: string
          comment: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          asset_id?: string
          comment?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_comments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_versions: {
        Row: {
          agency_id: string
          asset_id: string
          created_at: string
          file_size: number | null
          file_url: string
          id: string
          uploaded_by: string | null
          version_number: number
        }
        Insert: {
          agency_id: string
          asset_id: string
          created_at?: string
          file_size?: number | null
          file_url: string
          id?: string
          uploaded_by?: string | null
          version_number: number
        }
        Update: {
          agency_id?: string
          asset_id?: string
          created_at?: string
          file_size?: number | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_versions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_versions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          client_id: string
          content_type: string | null
          created_at: string
          current_version: number | null
          custom_category: string | null
          file_size: number | null
          file_type: string
          file_url: string
          filename: string
          final_caption: string | null
          hashtags: string | null
          id: string
          is_client_upload: boolean | null
          pipeline_stage: Database["public"]["Enums"]["pipeline_stage"] | null
          platform_captions: Json | null
          platforms: string[] | null
          post_url: string | null
          project_id: string | null
          scheduled_time: string | null
          status: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          uploaded_by: string | null
          visible_to_client: boolean | null
        }
        Insert: {
          client_id: string
          content_type?: string | null
          created_at?: string
          current_version?: number | null
          custom_category?: string | null
          file_size?: number | null
          file_type: string
          file_url: string
          filename: string
          final_caption?: string | null
          hashtags?: string | null
          id?: string
          is_client_upload?: boolean | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          platform_captions?: Json | null
          platforms?: string[] | null
          post_url?: string | null
          project_id?: string | null
          scheduled_time?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
          visible_to_client?: boolean | null
        }
        Update: {
          client_id?: string
          content_type?: string | null
          created_at?: string
          current_version?: number | null
          custom_category?: string | null
          file_size?: number | null
          file_type?: string
          file_url?: string
          filename?: string
          final_caption?: string | null
          hashtags?: string | null
          id?: string
          is_client_upload?: boolean | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          platform_captions?: Json | null
          platforms?: string[] | null
          post_url?: string | null
          project_id?: string | null
          scheduled_time?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
          visible_to_client?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_document_versions: {
        Row: {
          change_summary: string | null
          content_json: Json
          created_at: string
          created_by: string | null
          diff_json: Json | null
          document_id: string
          id: string
          version: number
        }
        Insert: {
          change_summary?: string | null
          content_json: Json
          created_at?: string
          created_by?: string | null
          diff_json?: Json | null
          document_id: string
          id?: string
          version: number
        }
        Update: {
          change_summary?: string | null
          content_json?: Json
          created_at?: string
          created_by?: string | null
          diff_json?: Json | null
          document_id?: string
          id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "brain_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "brain_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_documents: {
        Row: {
          agency_id: string
          approved_at: string | null
          approved_by: string | null
          content_json: Json
          created_at: string
          created_by: string | null
          id: string
          module: Database["public"]["Enums"]["brain_module"]
          parent_version_id: string | null
          source: Database["public"]["Enums"]["brain_document_source"]
          status: Database["public"]["Enums"]["brain_document_status"]
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          agency_id: string
          approved_at?: string | null
          approved_by?: string | null
          content_json?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          module: Database["public"]["Enums"]["brain_module"]
          parent_version_id?: string | null
          source?: Database["public"]["Enums"]["brain_document_source"]
          status?: Database["public"]["Enums"]["brain_document_status"]
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          agency_id?: string
          approved_at?: string | null
          approved_by?: string | null
          content_json?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          module?: Database["public"]["Enums"]["brain_module"]
          parent_version_id?: string | null
          source?: Database["public"]["Enums"]["brain_document_source"]
          status?: Database["public"]["Enums"]["brain_document_status"]
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "brain_documents_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_documents_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "brain_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      captions: {
        Row: {
          client_id: string
          content: string
          created_at: string
          id: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string
          id?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string
          id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "captions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "captions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_assets: {
        Row: {
          client_id: string
          created_at: string
          file_name: string | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_brains: {
        Row: {
          agency_id: string
          brain_json: Json
          client_id: string
          confidence: number
          created_at: string
          id: string
          json_diff: Json | null
          locked: boolean
          status: string
          updated_at: string
          usable: boolean
          version: number
        }
        Insert: {
          agency_id: string
          brain_json: Json
          client_id: string
          confidence?: number
          created_at?: string
          id?: string
          json_diff?: Json | null
          locked?: boolean
          status: string
          updated_at?: string
          usable?: boolean
          version: number
        }
        Update: {
          agency_id?: string
          brain_json?: Json
          client_id?: string
          confidence?: number
          created_at?: string
          id?: string
          json_diff?: Json | null
          locked?: boolean
          status?: string
          updated_at?: string
          usable?: boolean
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_brains_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_brains_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_brains_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_brains_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_brains_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_brains_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_branding: {
        Row: {
          accent_color: string | null
          brand_guidelines: string | null
          brand_palette: string[] | null
          brand_tone: string | null
          brand_voice: string | null
          client_id: string
          created_at: string
          id: string
          primary_color: string | null
          secondary_color: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          brand_guidelines?: string | null
          brand_palette?: string[] | null
          brand_tone?: string | null
          brand_voice?: string | null
          client_id: string
          created_at?: string
          id?: string
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          brand_guidelines?: string | null
          brand_palette?: string[] | null
          brand_tone?: string | null
          brand_voice?: string | null
          client_id?: string
          created_at?: string
          id?: string
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_branding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_branding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_branding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_branding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_branding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_hashtags: {
        Row: {
          category: string | null
          client_id: string
          created_at: string
          id: string
          tag: string
        }
        Insert: {
          category?: string | null
          client_id: string
          created_at?: string
          id?: string
          tag: string
        }
        Update: {
          category?: string | null
          client_id?: string
          created_at?: string
          id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_hashtags_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_hashtags_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_hashtags_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_hashtags_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_hashtags_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invites: {
        Row: {
          accepted: boolean | null
          agency_id: string
          client_id: string
          created_at: string | null
          email: string
          expires_at: string
          full_name: string | null
          id: string
          invite_token: string
          role: string
        }
        Insert: {
          accepted?: boolean | null
          agency_id: string
          client_id: string
          created_at?: string | null
          email: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invite_token: string
          role?: string
        }
        Update: {
          accepted?: boolean | null
          agency_id?: string
          client_id?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invite_token?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_invites_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_invites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_onboarding_sessions: {
        Row: {
          agency_id: string
          answers_json: Json
          brain_id: string
          client_id: string
          completed_required: boolean
          created_at: string
          id: string
          step_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_id: string
          answers_json?: Json
          brain_id: string
          client_id: string
          completed_required?: boolean
          created_at?: string
          id?: string
          step_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_id?: string
          answers_json?: Json
          brain_id?: string
          client_id?: string
          completed_required?: boolean
          created_at?: string
          id?: string
          step_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_onboarding_sessions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_onboarding_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_onboarding_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_onboarding_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_onboarding_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_onboarding_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_refresh_tokens: {
        Row: {
          client_user_id: string
          created_at: string
          expires_at: string
          id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          client_user_id: string
          created_at?: string
          expires_at: string
          id?: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          client_user_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_refresh_tokens_client_user_id_fkey"
            columns: ["client_user_id"]
            isOneToOne: false
            referencedRelation: "client_users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_reports: {
        Row: {
          agency_id: string
          client_id: string
          created_at: string
          data: Json
          id: string
          month: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          client_id: string
          created_at?: string
          data?: Json
          id?: string
          month: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          client_id?: string
          created_at?: string
          data?: Json
          id?: string
          month?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_reports_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_uploads: {
        Row: {
          agency_id: string
          client_id: string
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          uploaded_by: string
        }
        Insert: {
          agency_id: string
          client_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          uploaded_by: string
        }
        Update: {
          agency_id?: string
          client_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_uploads_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_uploads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_uploads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_uploads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_uploads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_uploads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_users: {
        Row: {
          agency_id: string
          client_id: string
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          invitation_status: string
          last_login_at: string | null
          password_hash: string
          password_reset_expires_at: string | null
          password_reset_token: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          client_id: string
          created_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          invitation_status?: string
          last_login_at?: string | null
          password_hash: string
          password_reset_expires_at?: string | null
          password_reset_token?: string | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          client_id?: string
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          invitation_status?: string
          last_login_at?: string | null
          password_hash?: string
          password_reset_expires_at?: string | null
          password_reset_token?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_users_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          agency_id: string
          brand_colors: Json | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          niche: string | null
          notes: string | null
          phone: string | null
          portal_enabled: boolean
          portal_slug: string | null
          portal_user_id: string | null
          primary_font: string | null
          secondary_font: string | null
          status: string | null
          tone_of_voice: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          agency_id: string
          brand_colors?: Json | null
          company?: string | null
          created_at?: string
          email?: string | null
          id: string
          logo_url?: string | null
          name: string
          niche?: string | null
          notes?: string | null
          phone?: string | null
          portal_enabled?: boolean
          portal_slug?: string | null
          portal_user_id?: string | null
          primary_font?: string | null
          secondary_font?: string | null
          status?: string | null
          tone_of_voice?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          agency_id?: string
          brand_colors?: Json | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          niche?: string | null
          notes?: string | null
          phone?: string | null
          portal_enabled?: boolean
          portal_slug?: string | null
          portal_user_id?: string | null
          primary_font?: string | null
          secondary_font?: string | null
          status?: string | null
          tone_of_voice?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      content_activities: {
        Row: {
          action: string
          actor_id: string
          client_id: string
          comment: string | null
          content_id: string
          content_type: string
          created_at: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id: string
          client_id: string
          comment?: string | null
          content_id: string
          content_type: string
          created_at?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string
          client_id?: string
          comment?: string | null
          content_id?: string
          content_type?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "content_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          agency_id: string
          agency_member_id: string | null
          client_user_id: string | null
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          agency_id: string
          agency_member_id?: string | null
          client_user_id?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          agency_id?: string
          agency_member_id?: string | null
          client_user_id?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_agency_member_id_fkey"
            columns: ["agency_member_id"]
            isOneToOne: false
            referencedRelation: "agency_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_client_user_id_fkey"
            columns: ["client_user_id"]
            isOneToOne: false
            referencedRelation: "client_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          agency_id: string
          client_id: string | null
          created_at: string
          id: string
          title: string | null
          type: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          client_id?: string | null
          created_at?: string
          id?: string
          title?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          client_id?: string | null
          created_at?: string
          id?: string
          title?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ideas: {
        Row: {
          attachments: Json | null
          client_id: string
          content_body: string | null
          created_at: string
          description: string | null
          id: string
          idea_references: Json | null
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          client_id: string
          content_body?: string | null
          created_at?: string
          description?: string | null
          id?: string
          idea_references?: Json | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          client_id?: string
          content_body?: string | null
          created_at?: string
          description?: string | null
          id?: string
          idea_references?: Json | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ideas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      message_read_receipts: {
        Row: {
          id: string
          message_id: string
          participant_id: string
          read_at: string
        }
        Insert: {
          id?: string
          message_id: string
          participant_id: string
          read_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          participant_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_read_receipts_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "conversation_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          agency_id: string
          attachment_url: string | null
          body: string | null
          client_id: string | null
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          related_project_id: string | null
          sender_agency_member_id: string | null
          sender_client_user_id: string | null
          sender_type: string
        }
        Insert: {
          agency_id: string
          attachment_url?: string | null
          body?: string | null
          client_id?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          related_project_id?: string | null
          sender_agency_member_id?: string | null
          sender_client_user_id?: string | null
          sender_type: string
        }
        Update: {
          agency_id?: string
          attachment_url?: string | null
          body?: string | null
          client_id?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          related_project_id?: string | null
          sender_agency_member_id?: string | null
          sender_client_user_id?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_related_project_id_fkey"
            columns: ["related_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_agency_member_id_fkey"
            columns: ["sender_agency_member_id"]
            isOneToOne: false
            referencedRelation: "agency_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_client_user_id_fkey"
            columns: ["sender_client_user_id"]
            isOneToOne: false
            referencedRelation: "client_users"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_sync_logs: {
        Row: {
          agency_id: string | null
          client_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          platform: string
          records_synced: number | null
          success: boolean
          sync_type: string
        }
        Insert: {
          agency_id?: string | null
          client_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          platform: string
          records_synced?: number | null
          success: boolean
          sync_type: string
        }
        Update: {
          agency_id?: string | null
          client_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          platform?: string
          records_synced?: number | null
          success?: boolean
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "metrics_sync_logs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metrics_sync_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "metrics_sync_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metrics_sync_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metrics_sync_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metrics_sync_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          allow_approval_reminders: boolean
          allow_email: boolean
          allow_in_app: boolean
          allow_mentions: boolean
          created_at: string
          email_on_approval: boolean
          email_on_changes_requested: boolean
          email_on_post_failed: boolean
          email_weekly_reminders: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_approval_reminders?: boolean
          allow_email?: boolean
          allow_in_app?: boolean
          allow_mentions?: boolean
          created_at?: string
          email_on_approval?: boolean
          email_on_changes_requested?: boolean
          email_on_post_failed?: boolean
          email_weekly_reminders?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_approval_reminders?: boolean
          allow_email?: boolean
          allow_in_app?: boolean
          allow_mentions?: boolean
          created_at?: string
          email_on_approval?: boolean
          email_on_changes_requested?: boolean
          email_on_post_failed?: boolean
          email_weekly_reminders?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          agency_id: string
          conversation_id: string | null
          created_at: string
          id: string
          payload: Json
          project_id: string | null
          read_at: string | null
          type: string
          user_id: string
          user_type: string
        }
        Insert: {
          agency_id: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          project_id?: string | null
          read_at?: string | null
          type: string
          user_id: string
          user_type: string
        }
        Update: {
          agency_id?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          project_id?: string | null
          read_at?: string | null
          type?: string
          user_id?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_comments: {
        Row: {
          attachments: Json | null
          author_agency_member: string | null
          author_client_user: string | null
          body: string
          created_at: string
          id: string
          is_internal: boolean
          project_id: string
        }
        Insert: {
          attachments?: Json | null
          author_agency_member?: string | null
          author_client_user?: string | null
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          project_id: string
        }
        Update: {
          attachments?: Json | null
          author_agency_member?: string | null
          author_client_user?: string | null
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_comments_author_agency_member_fkey"
            columns: ["author_agency_member"]
            isOneToOne: false
            referencedRelation: "agency_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_comments_author_client_user_fkey"
            columns: ["author_client_user"]
            isOneToOne: false
            referencedRelation: "client_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      post_logs: {
        Row: {
          attempt_number: number | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          platform: string
          project_id: string | null
          published_permalink: string | null
          request: Json | null
          response: Json | null
          scheduled_post_id: string | null
          success: boolean
        }
        Insert: {
          attempt_number?: number | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          platform: string
          project_id?: string | null
          published_permalink?: string | null
          request?: Json | null
          response?: Json | null
          scheduled_post_id?: string | null
          success: boolean
        }
        Update: {
          attempt_number?: number | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          platform?: string
          project_id?: string | null
          published_permalink?: string | null
          request?: Json | null
          response?: Json | null
          scheduled_post_id?: string | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "post_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_logs_scheduled_post_id_fkey"
            columns: ["scheduled_post_id"]
            isOneToOne: false
            referencedRelation: "scheduled_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_activities: {
        Row: {
          action: string
          actor_id: string
          actor_type: string
          agency_id: string
          client_id: string
          created_at: string
          id: string
          payload: Json | null
          project_id: string
        }
        Insert: {
          action: string
          actor_id: string
          actor_type: string
          agency_id: string
          client_id: string
          created_at?: string
          id?: string
          payload?: Json | null
          project_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          actor_type?: string
          agency_id?: string
          client_id?: string
          created_at?: string
          id?: string
          payload?: Json | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_activities_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "project_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_assets: {
        Row: {
          asset_id: string
          created_at: string | null
          display_order: number | null
          id: string
          is_final_content: boolean | null
          project_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_final_content?: boolean | null
          project_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_final_content?: boolean | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_failure_tracking: {
        Row: {
          alert_sent: boolean | null
          consecutive_failures: number
          created_at: string | null
          id: string
          last_failure_at: string | null
          project_id: string
          updated_at: string | null
        }
        Insert: {
          alert_sent?: boolean | null
          consecutive_failures?: number
          created_at?: string | null
          id?: string
          last_failure_at?: string | null
          project_id: string
          updated_at?: string | null
        }
        Update: {
          alert_sent?: boolean | null
          consecutive_failures?: number
          created_at?: string | null
          id?: string
          last_failure_at?: string | null
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_failure_tracking_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          agency_id: string
          assigned_to: string | null
          client_id: string
          created_at: string | null
          description: string | null
          editor_comments: string | null
          error_message: string | null
          final_asset_id: string | null
          hashtags: string | null
          hooks: Json | null
          id: string
          idea_id: string | null
          ideas: Json | null
          last_moved_at: string | null
          last_moved_by: string | null
          latest_activity_id: string | null
          notes: string | null
          pipeline_stage: string | null
          platform_captions: Json | null
          platforms: string[] | null
          published_at: string | null
          published_urls: Json | null
          rejection_category: string | null
          rejection_reason: string | null
          retry_count: number | null
          scheduled_for: string | null
          scheduled_time: string | null
          script: string | null
          script_id: string | null
          status: string | null
          thumbnail_url: string | null
          time_zone: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          assigned_to?: string | null
          client_id: string
          created_at?: string | null
          description?: string | null
          editor_comments?: string | null
          error_message?: string | null
          final_asset_id?: string | null
          hashtags?: string | null
          hooks?: Json | null
          id?: string
          idea_id?: string | null
          ideas?: Json | null
          last_moved_at?: string | null
          last_moved_by?: string | null
          latest_activity_id?: string | null
          notes?: string | null
          pipeline_stage?: string | null
          platform_captions?: Json | null
          platforms?: string[] | null
          published_at?: string | null
          published_urls?: Json | null
          rejection_category?: string | null
          rejection_reason?: string | null
          retry_count?: number | null
          scheduled_for?: string | null
          scheduled_time?: string | null
          script?: string | null
          script_id?: string | null
          status?: string | null
          thumbnail_url?: string | null
          time_zone?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          assigned_to?: string | null
          client_id?: string
          created_at?: string | null
          description?: string | null
          editor_comments?: string | null
          error_message?: string | null
          final_asset_id?: string | null
          hashtags?: string | null
          hooks?: Json | null
          id?: string
          idea_id?: string | null
          ideas?: Json | null
          last_moved_at?: string | null
          last_moved_by?: string | null
          latest_activity_id?: string | null
          notes?: string | null
          pipeline_stage?: string | null
          platform_captions?: Json | null
          platforms?: string[] | null
          published_at?: string | null
          published_urls?: Json | null
          rejection_category?: string | null
          rejection_reason?: string | null
          retry_count?: number | null
          scheduled_for?: string | null
          scheduled_time?: string | null
          script?: string | null
          script_id?: string | null
          status?: string | null
          thumbnail_url?: string | null
          time_zone?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "agency_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_final_asset_id_fkey"
            columns: ["final_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_latest_activity_id_fkey"
            columns: ["latest_activity_id"]
            isOneToOne: false
            referencedRelation: "project_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_posts: {
        Row: {
          agency_id: string
          caption: string | null
          client_id: string
          created_at: string
          error_message: string | null
          hashtags: string | null
          id: string
          platform: string
          platform_permalink: string | null
          platform_post_id: string | null
          project_id: string
          published_at: string | null
          retry_count: number | null
          scheduled_for: string
          social_connection_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          caption?: string | null
          client_id: string
          created_at?: string
          error_message?: string | null
          hashtags?: string | null
          id?: string
          platform: string
          platform_permalink?: string | null
          platform_post_id?: string | null
          project_id: string
          published_at?: string | null
          retry_count?: number | null
          scheduled_for: string
          social_connection_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          caption?: string | null
          client_id?: string
          created_at?: string
          error_message?: string | null
          hashtags?: string | null
          id?: string
          platform?: string
          platform_permalink?: string | null
          platform_post_id?: string | null
          project_id?: string
          published_at?: string | null
          retry_count?: number | null
          scheduled_for?: string
          social_connection_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "scheduled_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_social_connection_id_fkey"
            columns: ["social_connection_id"]
            isOneToOne: false
            referencedRelation: "social_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_social_connection_id_fkey"
            columns: ["social_connection_id"]
            isOneToOne: false
            referencedRelation: "social_connections_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          client_id: string
          created_at: string | null
          cta: string | null
          editor_notes: string | null
          hook: string | null
          id: string
          idea_id: string | null
          reference_attachments: Json | null
          script_body: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          cta?: string | null
          editor_notes?: string | null
          hook?: string | null
          id?: string
          idea_id?: string | null
          reference_attachments?: Json | null
          script_body?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          cta?: string | null
          editor_notes?: string | null
          hook?: string | null
          id?: string
          idea_id?: string | null
          reference_attachments?: Json | null
          script_body?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scripts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "scripts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripts_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      social_connections: {
        Row: {
          access_token: string | null
          account_handle: string | null
          account_id: string | null
          account_name: string | null
          client_id: string
          created_at: string
          id: string
          last_synced_at: string | null
          platform: string
          refresh_token: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          account_handle?: string | null
          account_id?: string | null
          account_name?: string | null
          client_id: string
          created_at?: string
          id?: string
          last_synced_at?: string | null
          platform: string
          refresh_token?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          account_handle?: string | null
          account_id?: string | null
          account_name?: string | null
          client_id?: string
          created_at?: string
          id?: string
          last_synced_at?: string | null
          platform?: string
          refresh_token?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_connections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "social_connections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_connections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_connections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_connections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      social_post_metrics: {
        Row: {
          agency_id: string
          clicks: number | null
          client_id: string
          comments: number | null
          created_at: string | null
          date: string
          id: string
          impressions: number | null
          likes: number | null
          platform: string
          platform_post_id: string
          project_id: string | null
          reach: number | null
          saves: number | null
          scheduled_post_id: string | null
          shares: number | null
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          clicks?: number | null
          client_id: string
          comments?: number | null
          created_at?: string | null
          date: string
          id?: string
          impressions?: number | null
          likes?: number | null
          platform: string
          platform_post_id: string
          project_id?: string | null
          reach?: number | null
          saves?: number | null
          scheduled_post_id?: string | null
          shares?: number | null
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          clicks?: number | null
          client_id?: string
          comments?: number | null
          created_at?: string | null
          date?: string
          id?: string
          impressions?: number | null
          likes?: number | null
          platform?: string
          platform_post_id?: string
          project_id?: string | null
          reach?: number | null
          saves?: number | null
          scheduled_post_id?: string | null
          shares?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_post_metrics_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_post_metrics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "social_post_metrics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_post_metrics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_post_metrics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_post_metrics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_post_metrics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_post_metrics_scheduled_post_id_fkey"
            columns: ["scheduled_post_id"]
            isOneToOne: false
            referencedRelation: "scheduled_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_profile_stats: {
        Row: {
          agency_id: string
          client_id: string
          created_at: string | null
          date: string
          followers: number | null
          id: string
          impressions: number | null
          platform: string
          profile_id: string
          profile_visits: number | null
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          client_id: string
          created_at?: string | null
          date: string
          followers?: number | null
          id?: string
          impressions?: number | null
          platform: string
          profile_id: string
          profile_visits?: number | null
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          client_id?: string
          created_at?: string | null
          date?: string
          followers?: number | null
          id?: string
          impressions?: number | null
          platform?: string
          profile_id?: string
          profile_visits?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_profile_stats_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_profile_stats_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "social_profile_stats_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_profile_stats_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_profile_stats_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_profile_stats_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      social_profiles: {
        Row: {
          client_id: string
          created_at: string
          id: string
          platform: string
          url: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          platform: string
          url: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          platform?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "social_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_history: {
        Row: {
          actor_id: string | null
          client_id: string
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          module: Database["public"]["Enums"]["strategy_module"] | null
          module_id: string | null
          strategy_id: string | null
        }
        Insert: {
          actor_id?: string | null
          client_id: string
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          module?: Database["public"]["Enums"]["strategy_module"] | null
          module_id?: string | null
          strategy_id?: string | null
        }
        Update: {
          actor_id?: string | null
          client_id?: string
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          module?: Database["public"]["Enums"]["strategy_module"] | null
          module_id?: string | null
          strategy_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategy_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "strategy_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_history_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "strategy_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      strategies: {
        Row: {
          agency_id: string
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          status: string
          updated_at: string
          version_int: number
        }
        Insert: {
          agency_id: string
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          status?: string
          updated_at?: string
          version_int?: number
        }
        Update: {
          agency_id?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          status?: string
          updated_at?: string
          version_int?: number
        }
        Relationships: [
          {
            foreignKeyName: "strategies_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_decisions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          client_id: string
          created_at: string
          decision_key: string
          id: string
          locked: boolean
          module: Database["public"]["Enums"]["strategy_module"]
          strategy_id: string
          updated_at: string
          value: Json | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          client_id: string
          created_at?: string
          decision_key: string
          id?: string
          locked?: boolean
          module: Database["public"]["Enums"]["strategy_module"]
          strategy_id: string
          updated_at?: string
          value?: Json | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string
          created_at?: string
          decision_key?: string
          id?: string
          locked?: boolean
          module?: Database["public"]["Enums"]["strategy_module"]
          strategy_id?: string
          updated_at?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "strategy_decisions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_decisions_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_modules: {
        Row: {
          agency_id: string
          ai_confidence: number | null
          ai_generated: boolean | null
          blocker_count: number | null
          blockers: Json | null
          client_id: string
          completion_percent: number | null
          content_json: Json
          created_at: string
          created_by: string | null
          id: string
          last_updated_at: string
          locked: boolean
          locked_at: string | null
          locked_by: string | null
          module: Database["public"]["Enums"]["strategy_module"]
          next_review_at: string | null
          owner_id: string | null
          strategy_id: string
          status: Database["public"]["Enums"]["strategy_status"]
          updated_at: string
          version: number
        }
        Insert: {
          agency_id: string
          ai_confidence?: number | null
          ai_generated?: boolean | null
          blocker_count?: number | null
          blockers?: Json | null
          client_id: string
          completion_percent?: number | null
          content_json?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          last_updated_at?: string
          locked?: boolean
          locked_at?: string | null
          locked_by?: string | null
          module: Database["public"]["Enums"]["strategy_module"]
          next_review_at?: string | null
          owner_id?: string | null
          strategy_id?: string
          status?: Database["public"]["Enums"]["strategy_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          agency_id?: string
          ai_confidence?: number | null
          ai_generated?: boolean | null
          blocker_count?: number | null
          blockers?: Json | null
          client_id?: string
          completion_percent?: number | null
          content_json?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          last_updated_at?: string
          locked?: boolean
          locked_at?: string | null
          locked_by?: string | null
          module?: Database["public"]["Enums"]["strategy_module"]
          next_review_at?: string | null
          owner_id?: string | null
          strategy_id?: string
          status?: Database["public"]["Enums"]["strategy_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "strategy_modules_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_modules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "strategy_modules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_modules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_modules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_modules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_tasks: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          dedupe_key: string | null
          description: string | null
          id: string
          module: Database["public"]["Enums"]["strategy_module"] | null
          module_id: string | null
          pipeline_task_id: string | null
          period_key: string | null
          priority: string | null
          project_id: string | null
          status: string
          strategy_id: string | null
          task_id: string | null
          title: string
          updated_at: string
          slug: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          description?: string | null
          id?: string
          module?: Database["public"]["Enums"]["strategy_module"] | null
          module_id?: string | null
          pipeline_task_id?: string | null
          period_key?: string | null
          priority?: string | null
          project_id?: string | null
          status?: string
          strategy_id?: string | null
          task_id?: string | null
          title: string
          updated_at?: string
          slug?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          description?: string | null
          id?: string
          module?: Database["public"]["Enums"]["strategy_module"] | null
          module_id?: string | null
          pipeline_task_id?: string | null
          period_key?: string | null
          priority?: string | null
          project_id?: string | null
          status?: string
          strategy_id?: string | null
          task_id?: string | null
          title?: string
          updated_at?: string
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategy_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "strategy_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_tasks_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "strategy_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan_type: string
          status: string
          storage_used: number
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_type?: string
          status?: string
          storage_used?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_type?: string
          status?: string
          storage_used?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_module_requirements: {
        Row: {
          created_at: string
          field_paths: string[] | null
          id: string
          module: Database["public"]["Enums"]["brain_module"]
          required: boolean
          task_type: string
        }
        Insert: {
          created_at?: string
          field_paths?: string[] | null
          id?: string
          module: Database["public"]["Enums"]["brain_module"]
          required?: boolean
          task_type: string
        }
        Update: {
          created_at?: string
          field_paths?: string[] | null
          id?: string
          module?: Database["public"]["Enums"]["brain_module"]
          required?: boolean
          task_type?: string
        }
        Relationships: []
      }
      task_templates: {
        Row: {
          agency_id: string
          checklist: Json | null
          created_at: string
          created_by: string | null
          default_priority: string
          default_status: string
          description: string | null
          estimated_hours: number | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          checklist?: Json | null
          created_at?: string
          created_by?: string | null
          default_priority?: string
          default_status?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          checklist?: Json | null
          created_at?: string
          created_by?: string | null
          default_priority?: string
          default_status?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          agency_id: string
          assigned_to: string | null
          client_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          assigned_to?: string | null
          client_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          assigned_to?: string | null
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      token_refresh_logs: {
        Row: {
          created_at: string | null
          error_code: string | null
          id: string
          new_token_preview: string | null
          old_token_preview: string | null
          response: Json | null
          social_connection_id: string | null
          success: boolean
        }
        Insert: {
          created_at?: string | null
          error_code?: string | null
          id?: string
          new_token_preview?: string | null
          old_token_preview?: string | null
          response?: Json | null
          social_connection_id?: string | null
          success: boolean
        }
        Update: {
          created_at?: string | null
          error_code?: string | null
          id?: string
          new_token_preview?: string | null
          old_token_preview?: string | null
          response?: Json | null
          social_connection_id?: string | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "token_refresh_logs_social_connection_id_fkey"
            columns: ["social_connection_id"]
            isOneToOne: false
            referencedRelation: "social_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_refresh_logs_social_connection_id_fkey"
            columns: ["social_connection_id"]
            isOneToOne: false
            referencedRelation: "social_connections_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waitlist_subscribers: {
        Row: {
          agency_size: string | null
          created_at: string | null
          email: string
          id: string
          name: string | null
          pain_point: string | null
        }
        Insert: {
          agency_size?: string | null
          created_at?: string | null
          email: string
          id?: string
          name?: string | null
          pain_point?: string | null
        }
        Update: {
          agency_size?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          pain_point?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      ai_generation_usage_compat_v: {
        Row: {
          agency_id: string | null
          created_at: string | null
          generation_type: string | null
          id: string | null
          month_year: string | null
          user_id: string | null
        }
        Insert: {
          agency_id?: string | null
          created_at?: string | null
          generation_type?: never
          id?: string | null
          month_year?: never
          user_id?: string | null
        }
        Update: {
          agency_id?: string | null
          created_at?: string | null
          generation_type?: never
          id?: string | null
          month_year?: never
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generation_usage_from_runs_v: {
        Row: {
          agency_id: string | null
          created_at: string | null
          generation_type: string | null
          id: string | null
          month_year: string | null
          user_id: string | null
        }
        Insert: {
          agency_id?: string | null
          created_at?: string | null
          generation_type?: never
          id?: string | null
          month_year?: never
          user_id?: string | null
        }
        Update: {
          agency_id?: string | null
          created_at?: string | null
          generation_type?: never
          id?: string | null
          month_year?: never
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_history_compat_v: {
        Row: {
          agency_id: string | null
          client_id: string | null
          created_at: string | null
          id: string | null
          input: Json | null
          mode: string | null
          output: Json | null
          project_id: string | null
        }
        Insert: {
          agency_id?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string | null
          input?: never
          mode?: never
          output?: never
          project_id?: never
        }
        Update: {
          agency_id?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string | null
          input?: never
          mode?: never
          output?: never
          project_id?: never
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ai_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_history_from_runs_v: {
        Row: {
          agency_id: string | null
          client_id: string | null
          created_at: string | null
          id: string | null
          input: Json | null
          mode: string | null
          output: Json | null
          project_id: string | null
        }
        Insert: {
          agency_id?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string | null
          input?: never
          mode?: never
          output?: never
          project_id?: never
        }
        Update: {
          agency_id?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string | null
          input?: never
          mode?: never
          output?: never
          project_id?: never
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ai_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_asset_counts: {
        Row: {
          asset_count: number | null
          client_id: string | null
          published_video_count: number | null
        }
        Relationships: []
      }
      client_contacts_secure: {
        Row: {
          agency_id: string | null
          company: string | null
          email: string | null
          id: string | null
          phone: string | null
        }
        Insert: {
          agency_id?: string | null
          company?: string | null
          email?: string | null
          id?: string | null
          phone?: string | null
        }
        Update: {
          agency_id?: string | null
          company?: string | null
          email?: string | null
          id?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_view: {
        Row: {
          agency_id: string | null
          brand_colors: Json | null
          created_at: string | null
          id: string | null
          logo_url: string | null
          name: string | null
          niche: string | null
          notes: string | null
          portal_enabled: boolean | null
          portal_slug: string | null
          primary_font: string | null
          secondary_font: string | null
          tone_of_voice: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          agency_id?: string | null
          brand_colors?: Json | null
          created_at?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          niche?: string | null
          notes?: string | null
          portal_enabled?: boolean | null
          portal_slug?: string | null
          primary_font?: string | null
          secondary_font?: string | null
          tone_of_voice?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          agency_id?: string | null
          brand_colors?: Json | null
          created_at?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          niche?: string | null
          notes?: string | null
          portal_enabled?: boolean | null
          portal_slug?: string | null
          primary_font?: string | null
          secondary_font?: string | null
          tone_of_voice?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_public_clients: {
        Row: {
          id: string | null
          logo_url: string | null
          name: string | null
          portal_enabled: boolean | null
          portal_slug: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          id?: string | null
          logo_url?: string | null
          name?: string | null
          portal_enabled?: boolean | null
          portal_slug?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          id?: string | null
          logo_url?: string | null
          name?: string | null
          portal_enabled?: boolean | null
          portal_slug?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      social_connections_safe: {
        Row: {
          account_handle: string | null
          account_id: string | null
          account_name: string | null
          client_id: string | null
          created_at: string | null
          id: string | null
          last_synced_at: string | null
          platform: string | null
          status: string | null
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          account_handle?: string | null
          account_id?: string | null
          account_name?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string | null
          last_synced_at?: string | null
          platform?: string | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          account_handle?: string | null
          account_id?: string | null
          account_name?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string | null
          last_synced_at?: string | null
          platform?: string | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_connections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_asset_counts"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "social_connections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_contacts_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_connections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_connections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_connections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portal_public_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ai_budget_health: {
        Row: {
          agency_id: string | null
          cost_estimation_method: string | null
          estimate_vs_token_based_pct: number | null
          estimated_spend_usd: number | null
          spend_usd: number | null
          token_based_spend_usd: number | null
          total_spend_usd: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ai_citation_failures: {
        Row: {
          top_error_types: Json | null
          top_task_types: Json | null
          total_error_runs: number | null
        }
        Relationships: []
      }
      v_ai_embeddings_health: {
        Row: {
          embed_failure_calls_30d: number | null
          embed_failure_rate_30d: number | null
          legacy_zero_vector_true_rate_30d: number | null
          total_embedding_calls_30d: number | null
          zero_vectors_remaining: number | null
        }
        Relationships: []
      }
      v_ai_legacy_table_writes: {
        Row: {
          ai_generation_usage_inserts_7d: number | null
          ai_generation_usage_last_insert_at: string | null
          ai_history_inserts_7d: number | null
          ai_history_last_insert_at: string | null
        }
        Relationships: []
      }
      v_ai_rag_health: {
        Row: {
          avg_retrieval_count: number | null
          citation_coverage_rate: number | null
          context_truncated_rate: number | null
          doc_types_used_distribution: Json | null
          rag_policy_version_distribution: Json | null
          total_runs: number | null
          window_end: string | null
          window_start: string | null
        }
        Relationships: []
      }
      v_ai_router_compliance: {
        Row: {
          router_compliance_pct: number | null
          runs_with_usage_log: number | null
          total_runs: number | null
        }
        Relationships: []
      }
      v_ai_runs_last_24h: {
        Row: {
          avg_latency_ms: number | null
          error_calls: number | null
          error_rate: number | null
          provider: string | null
          runtime_model: string | null
          task_type: string | null
          total_calls: number | null
        }
        Relationships: []
      }
      v_ai_timeouts_retries: {
        Row: {
          retry_attempts_0: number | null
          retry_attempts_1: number | null
          retry_attempts_2: number | null
          retry_rate: number | null
          task_type: string | null
          timeout_count: number | null
          timeout_rate: number | null
          total_calls: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_agency_invite: { Args: { _invite_id: string }; Returns: string }
      add_strategy_history: {
        Args: {
          p_client_id: string
          p_event_data?: Json
          p_event_type: string
          p_module: Database["public"]["Enums"]["strategy_module"]
          p_module_id: string
          p_strategy_id: string
        }
        Returns: {
          actor_id: string | null
          client_id: string
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          module: Database["public"]["Enums"]["strategy_module"] | null
          module_id: string | null
          strategy_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "strategy_history"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ai_budget_apply_delta: {
        Args: {
          p_agency_id: string
          p_delta_usd: number
          p_enforce?: boolean
          p_month_yyyy_mm: string
        }
        Returns: {
          allowed: boolean
          budget_id: string
          budget_usd: number
          hard_stop: boolean
          spent_usd: number
        }[]
      }
      approve_brain_document: {
        Args: { p_document_id: string }
        Returns: {
          agency_id: string
          approved_at: string | null
          approved_by: string | null
          content_json: Json
          created_at: string
          created_by: string | null
          id: string
          module: Database["public"]["Enums"]["brain_module"]
          parent_version_id: string | null
          source: Database["public"]["Enums"]["brain_document_source"]
          status: Database["public"]["Enums"]["brain_document_status"]
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "brain_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_agency_with_admin: {
        Args: { _name: string; _website?: string }
        Returns: string
      }
      create_brain_document_draft: {
        Args: {
          p_agency_id: string
          p_content_json: Json
          p_module: Database["public"]["Enums"]["brain_module"]
          p_source?: Database["public"]["Enums"]["brain_document_source"]
          p_title: string
        }
        Returns: {
          agency_id: string
          approved_at: string | null
          approved_by: string | null
          content_json: Json
          created_at: string
          created_by: string | null
          id: string
          module: Database["public"]["Enums"]["brain_module"]
          parent_version_id: string | null
          source: Database["public"]["Enums"]["brain_document_source"]
          status: Database["public"]["Enums"]["brain_document_status"]
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "brain_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decline_agency_invite: { Args: { _invite_id: string }; Returns: boolean }
      delete_client_cascade: {
        Args: { p_client_id: string }
        Returns: undefined
      }
      delete_client_cascade_admin: {
        Args: { client_id: string }
        Returns: Json
      }
      delete_project_cascade: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      generate_portal_invite_token: { Args: never; Returns: string }
      generate_portal_slug: { Args: never; Returns: string }
      generate_portal_token: { Args: never; Returns: string }
      get_agency_invite_by_token: {
        Args: { _token: string }
        Returns: {
          accepted: boolean
          agency_id: string
          agency_name: string
          declined: boolean
          email: string
          expires_at: string
          invite_id: string
          role: string
        }[]
      }
      get_agency_members: {
        Args: { p_agency_id: string }
        Returns: {
          email: string
          full_name: string
          role: string
          user_id: string
        }[]
      }
      get_approved_brain_documents: {
        Args: { p_agency_id: string }
        Returns: {
          agency_id: string
          approved_at: string | null
          approved_by: string | null
          content_json: Json
          created_at: string
          created_by: string | null
          id: string
          module: Database["public"]["Enums"]["brain_module"]
          parent_version_id: string | null
          source: Database["public"]["Enums"]["brain_document_source"]
          status: Database["public"]["Enums"]["brain_document_status"]
          title: string
          updated_at: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "brain_documents"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_brain_document: {
        Args: {
          p_agency_id: string
          p_module: Database["public"]["Enums"]["brain_module"]
          p_status?: Database["public"]["Enums"]["brain_document_status"]
        }
        Returns: {
          agency_id: string
          approved_at: string | null
          approved_by: string | null
          content_json: Json
          created_at: string
          created_by: string | null
          id: string
          module: Database["public"]["Enums"]["brain_module"]
          parent_version_id: string | null
          source: Database["public"]["Enums"]["brain_document_source"]
          status: Database["public"]["Enums"]["brain_document_status"]
          title: string
          updated_at: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "brain_documents"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_brain_document_history: {
        Args: { p_document_id: string }
        Returns: {
          change_summary: string | null
          content_json: Json
          created_at: string
          created_by: string | null
          diff_json: Json | null
          document_id: string
          id: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "brain_document_versions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_client_brain_status: {
        Args: { p_client_id: string }
        Returns: {
          client_id: string
          locked: boolean
          missing_fields: string[]
          missing_fields_count: number
          status: string
          updated_at: string
          usable: boolean
          version: number
        }[]
      }
      get_monthly_ai_usage: { Args: { p_agency_id: string }; Returns: number }
      get_my_pending_agency_invites: {
        Args: never
        Returns: {
          agency_id: string
          agency_name: string
          created_at: string
          email: string
          expires_at: string
          invite_id: string
          invited_by: string
          role: string
          token: string
        }[]
      }
      get_social_connection_tokens: {
        Args: { _connection_id: string }
        Returns: {
          access_token: string
          refresh_token: string
          token_expires_at: string
        }[]
      }
      get_strategy_modules: {
        Args: { p_strategy_id: string }
        Returns: {
          agency_id: string
          ai_confidence: number | null
          ai_generated: boolean | null
          blocker_count: number | null
          blockers: Json | null
          client_id: string
          completion_percent: number | null
          content_json: Json
          created_at: string
          created_by: string | null
          id: string
          last_updated_at: string
          locked: boolean
          locked_at: string | null
          locked_by: string | null
          module: Database["public"]["Enums"]["strategy_module"]
          next_review_at: string | null
          owner_id: string | null
          strategy_id: string
          status: Database["public"]["Enums"]["strategy_status"]
          updated_at: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "strategy_modules"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_agency_bootstrap: { Args: never; Returns: Json }
      get_user_client_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_agency_admin: {
        Args: { _agency_id: string; _user_id: string }
        Returns: boolean
      }
      is_agency_member:
        | { Args: { _user_id: string }; Returns: boolean }
        | { Args: { p_agency_id: string; p_user_id: string }; Returns: boolean }
      is_agency_owner: {
        Args: { _agency_id: string; _user_id: string }
        Returns: boolean
      }
      is_client_user: { Args: { _user_id: string }; Returns: boolean }
      is_member_of_agency: { Args: { _agency_id: string }; Returns: boolean }
      is_member_of_client: { Args: { _client_id: string }; Returns: boolean }
      mask_email: { Args: { _email: string }; Returns: string }
      match_ai_embeddings: {
        Args: {
          p_agency_id: string
          p_client_id?: string
          p_doc_types?: string[]
          p_match_count?: number
          p_query_embedding: string
        }
        Returns: {
          chunk_id: string
          chunk_text: string
          doc_type: string
          document_id: string
          score: number
          source: Json
          source_url: string
          title: string
        }[]
      }
      toggle_strategy_module_lock: {
        Args: { p_lock: boolean; p_module_id: string }
        Returns: {
          agency_id: string
          ai_confidence: number | null
          ai_generated: boolean | null
          blocker_count: number | null
          blockers: Json | null
          client_id: string
          completion_percent: number | null
          content_json: Json
          created_at: string
          created_by: string | null
          id: string
          last_updated_at: string
          locked: boolean
          locked_at: string | null
          locked_by: string | null
          module: Database["public"]["Enums"]["strategy_module"]
          next_review_at: string | null
          owner_id: string | null
          strategy_id: string
          status: Database["public"]["Enums"]["strategy_status"]
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "strategy_modules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_pipeline_stage: {
        Args: {
          _asset_id: string
          _new_stage: Database["public"]["Enums"]["pipeline_stage"]
        }
        Returns: Json
      }
      transition_project_status: {
        Args: {
          _new_status: Database["public"]["Enums"]["project_status"]
          _project_id: string
        }
        Returns: Json
      }
      update_brain_document: {
        Args: {
          p_change_summary?: string
          p_content_json: Json
          p_document_id: string
        }
        Returns: {
          agency_id: string
          approved_at: string | null
          approved_by: string | null
          content_json: Json
          created_at: string
          created_by: string | null
          id: string
          module: Database["public"]["Enums"]["brain_module"]
          parent_version_id: string | null
          source: Database["public"]["Enums"]["brain_document_source"]
          status: Database["public"]["Enums"]["brain_document_status"]
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "brain_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_strategy_module: {
        Args: {
          p_agency_id: string
          p_ai_confidence?: number
          p_ai_generated?: boolean
          p_client_id: string
          p_content_json: Json
          p_module: Database["public"]["Enums"]["strategy_module"]
          p_status?: Database["public"]["Enums"]["strategy_status"]
          p_strategy_id: string
        }
        Returns: {
          agency_id: string
          ai_confidence: number | null
          ai_generated: boolean | null
          blocker_count: number | null
          blockers: Json | null
          client_id: string
          completion_percent: number | null
          content_json: Json
          created_at: string
          created_by: string | null
          id: string
          last_updated_at: string
          locked: boolean
          locked_at: string | null
          locked_by: string | null
          module: Database["public"]["Enums"]["strategy_module"]
          next_review_at: string | null
          owner_id: string | null
          strategy_id: string
          status: Database["public"]["Enums"]["strategy_status"]
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "strategy_modules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "owner" | "manager" | "client"
      approval_status: "pending" | "approved" | "changes_requested"
      brain_document_source: "onboarding" | "chat" | "manual" | "ai_proposed"
      brain_document_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "archived"
      brain_module:
        | "bootstrap"
        | "rep_policy"
        | "sop_strategy"
        | "sop_scripting"
        | "tone_voice"
        | "faq_objections"
        | "ai_permissions"
        | "offer_stack"
        | "quality_bar"
      pipeline_stage:
        | "raw"
        | "editing"
        | "approval"
        | "final"
        | "scheduled"
        | "published"
      project_status:
        | "idea"
        | "scripting"
        | "production"
        | "internal_review"
        | "client_review"
        | "approved"
        | "scheduled"
        | "published"
      strategy_module:
        | "positioning"
        | "pillars"
        | "campaign_plan"
        | "weekly_plan"
        | "channel_adaptations"
        | "rules_constraints"
      strategy_status:
        | "empty"
        | "ai_draft"
        | "draft"
        | "review"
        | "approved"
        | "locked"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "manager", "client"],
      approval_status: ["pending", "approved", "changes_requested"],
      brain_document_source: ["onboarding", "chat", "manual", "ai_proposed"],
      brain_document_status: [
        "draft",
        "pending_approval",
        "approved",
        "archived",
      ],
      brain_module: [
        "bootstrap",
        "rep_policy",
        "sop_strategy",
        "sop_scripting",
        "tone_voice",
        "faq_objections",
        "ai_permissions",
        "offer_stack",
        "quality_bar",
      ],
      pipeline_stage: [
        "raw",
        "editing",
        "approval",
        "final",
        "scheduled",
        "published",
      ],
      project_status: [
        "idea",
        "scripting",
        "production",
        "internal_review",
        "client_review",
        "approved",
        "scheduled",
        "published",
      ],
      strategy_module: [
        "positioning",
        "pillars",
        "campaign_plan",
        "weekly_plan",
        "channel_adaptations",
        "rules_constraints",
      ],
      strategy_status: [
        "empty",
        "ai_draft",
        "draft",
        "review",
        "approved",
        "locked",
      ],
    },
  },
} as const;
