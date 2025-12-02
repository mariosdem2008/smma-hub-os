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
          id: string
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
      agency_invites: {
        Row: {
          accepted: boolean
          agency_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          role: string
          token: string
        }
        Insert: {
          accepted?: boolean
          agency_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          role?: string
          token?: string
        }
        Update: {
          accepted?: boolean
          agency_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          role?: string
          token?: string
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
            foreignKeyName: "ai_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          error_message: string | null
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
          error_message?: string | null
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
          error_message?: string | null
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
            foreignKeyName: "assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
        ]
      }
      notification_preferences: {
        Row: {
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
          notes: string | null
          pipeline_stage: string | null
          platform_captions: Json | null
          platforms: string[] | null
          published_at: string | null
          published_urls: Json | null
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
          notes?: string | null
          pipeline_stage?: string | null
          platform_captions?: Json | null
          platforms?: string[] | null
          published_at?: string | null
          published_urls?: Json | null
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
          notes?: string | null
          pipeline_stage?: string | null
          platform_captions?: Json | null
          platforms?: string[] | null
          published_at?: string | null
          published_urls?: Json | null
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
        ]
      }
      team_members: {
        Row: {
          agency_id: string
          assigned_clients: string[] | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_id: string
          assigned_clients?: string[] | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_id?: string
          assigned_clients?: string[] | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
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
        ]
      }
    }
    Functions: {
      accept_agency_invite: {
        Args: { _invite_token: string; _user_id: string }
        Returns: Json
      }
      delete_client_cascade: {
        Args: { p_client_id: string }
        Returns: undefined
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
          email: string
          expires_at: string
          id: string
          role: string
        }[]
      }
      get_monthly_ai_usage: { Args: { p_agency_id: string }; Returns: number }
      get_social_connection_tokens: {
        Args: { _connection_id: string }
        Returns: {
          access_token: string
          refresh_token: string
          token_expires_at: string
        }[]
      }
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
      is_agency_member: { Args: { _user_id: string }; Returns: boolean }
      is_agency_owner: {
        Args: { _agency_id: string; _user_id: string }
        Returns: boolean
      }
      is_client_user: { Args: { _user_id: string }; Returns: boolean }
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
    }
    Enums: {
      app_role: "owner" | "manager" | "client"
      approval_status: "pending" | "approved" | "changes_requested"
      pipeline_stage:
        | "idea"
        | "in_production"
        | "review"
        | "approved"
        | "scheduled"
        | "published"
        | "failed"
      project_status:
        | "idea"
        | "scripting"
        | "production"
        | "internal_review"
        | "client_review"
        | "approved"
        | "scheduled"
        | "published"
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
      pipeline_stage: [
        "idea",
        "in_production",
        "review",
        "approved",
        "scheduled",
        "published",
        "failed",
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
    },
  },
} as const
