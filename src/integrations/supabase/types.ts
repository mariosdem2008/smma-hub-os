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
          id?: string
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
      ideas: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          id: string
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
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
      messages: {
        Row: {
          attachment_url: string | null
          client_id: string
          content: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          client_id: string
          content: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          client_id?: string
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
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
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
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
      is_agency_owner: {
        Args: { _agency_id: string; _user_id: string }
        Returns: boolean
      }
      transition_pipeline_stage: {
        Args: {
          _asset_id: string
          _new_stage: Database["public"]["Enums"]["pipeline_stage"]
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
    },
  },
} as const
