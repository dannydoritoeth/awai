export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      agent_actions: {
        Row: {
          action_type: string | null
          agent_name: string | null
          company_id: string | null
          confidence_score: number | null
          created_at: string | null
          embedding: string | null
          id: string
          outcome: string | null
          payload: Json | null
          request: Json | null
          request_hash: string | null
          response: Json | null
          session_id: string | null
          step_index: number | null
          target_id: string | null
          target_type: string | null
          timestamp: string | null
        }
        Insert: {
          action_type?: string | null
          agent_name?: string | null
          company_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          outcome?: string | null
          payload?: Json | null
          request?: Json | null
          request_hash?: string | null
          response?: Json | null
          session_id?: string | null
          step_index?: number | null
          target_id?: string | null
          target_type?: string | null
          timestamp?: string | null
        }
        Update: {
          action_type?: string | null
          agent_name?: string | null
          company_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          outcome?: string | null
          payload?: Json | null
          request?: Json | null
          request_hash?: string | null
          response?: Json | null
          session_id?: string | null
          step_index?: number | null
          target_id?: string | null
          target_type?: string | null
          timestamp?: string | null
        }
        Relationships: []
      }
      ai_model_invocations: {
        Row: {
          action_type: string | null
          created_at: string
          error_message: string | null
          id: string
          latency_ms: number | null
          max_tokens: number | null
          messages: Json | null
          model_name: string
          model_provider: Database["public"]["Enums"]["ai_model_provider"]
          other_params: Json | null
          response_metadata: Json | null
          response_text: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["ai_invocation_status"]
          system_prompt: string | null
          temperature: number | null
          token_usage: Json | null
          user_prompt: string | null
        }
        Insert: {
          action_type?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          max_tokens?: number | null
          messages?: Json | null
          model_name: string
          model_provider: Database["public"]["Enums"]["ai_model_provider"]
          other_params?: Json | null
          response_metadata?: Json | null
          response_text?: string | null
          session_id?: string | null
          status: Database["public"]["Enums"]["ai_invocation_status"]
          system_prompt?: string | null
          temperature?: number | null
          token_usage?: Json | null
          user_prompt?: string | null
        }
        Update: {
          action_type?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          max_tokens?: number | null
          messages?: Json | null
          model_name?: string
          model_provider?: Database["public"]["Enums"]["ai_model_provider"]
          other_params?: Json | null
          response_metadata?: Json | null
          response_text?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["ai_invocation_status"]
          system_prompt?: string | null
          temperature?: number | null
          token_usage?: Json | null
          user_prompt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_model_invocations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "conversation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      capabilities: {
        Row: {
          company_id: string | null
          created_at: string | null
          description: string | null
          embedding: string | null
          embedding_text_hash: string | null
          group_name: string | null
          id: string
          is_occupation_specific: boolean | null
          name: string
          source_framework: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          embedding_text_hash?: string | null
          group_name?: string | null
          id?: string
          is_occupation_specific?: boolean | null
          name: string
          source_framework?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          embedding_text_hash?: string | null
          group_name?: string | null
          id?: string
          is_occupation_specific?: boolean | null
          name?: string
          source_framework?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      capability_levels: {
        Row: {
          behavioral_indicators: string[] | null
          capability_id: string | null
          created_at: string | null
          id: string
          level: string | null
          summary: string | null
          updated_at: string | null
        }
        Insert: {
          behavioral_indicators?: string[] | null
          capability_id?: string | null
          created_at?: string | null
          id?: string
          level?: string | null
          summary?: string | null
          updated_at?: string | null
        }
        Update: {
          behavioral_indicators?: string[] | null
          capability_id?: string | null
          created_at?: string | null
          id?: string
          level?: string | null
          summary?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capability_levels_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
        ]
      }
      career_paths: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          path_type: string | null
          popularity_score: number | null
          recommended_by: string | null
          skill_gap_summary: string | null
          source_role_id: string | null
          supporting_evidence: string[] | null
          target_role_id: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          path_type?: string | null
          popularity_score?: number | null
          recommended_by?: string | null
          skill_gap_summary?: string | null
          source_role_id?: string | null
          supporting_evidence?: string[] | null
          target_role_id?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          path_type?: string | null
          popularity_score?: number | null
          recommended_by?: string | null
          skill_gap_summary?: string | null
          source_role_id?: string | null
          supporting_evidence?: string[] | null
          target_role_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "career_paths_source_role_id_fkey"
            columns: ["source_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_paths_target_role_id_fkey"
            columns: ["target_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          embedding: string | null
          id: string
          message: string
          sender: string | null
          session_id: string | null
          timestamp: string | null
        }
        Insert: {
          embedding?: string | null
          id?: string
          message: string
          sender?: string | null
          session_id?: string | null
          timestamp?: string | null
        }
        Update: {
          embedding?: string | null
          id?: string
          message?: string
          sender?: string | null
          session_id?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "conversation_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_session"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "conversation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string | null
          description: string | null
          embedding: string | null
          embedding_text_hash: string | null
          id: string
          institution_id: string | null
          name: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          embedding_text_hash?: string | null
          id?: string
          institution_id?: string | null
          name: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          embedding_text_hash?: string | null
          id?: string
          institution_id?: string | null
          name?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_sessions: {
        Row: {
          browser_session_id: string | null
          created_at: string | null
          entity_id: string | null
          id: string
          mode: string | null
          profile_id: string | null
          status: string | null
          summary: string | null
          updated_at: string | null
        }
        Insert: {
          browser_session_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          id?: string
          mode?: string | null
          profile_id?: string | null
          status?: string | null
          summary?: string | null
          updated_at?: string | null
        }
        Update: {
          browser_session_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          id?: string
          mode?: string | null
          profile_id?: string | null
          status?: string | null
          summary?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_profile"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      divisions: {
        Row: {
          agency: string | null
          cluster: string | null
          company_id: string | null
          created_at: string | null
          embedding: string | null
          embedding_text_hash: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          agency?: string | null
          cluster?: string | null
          company_id?: string | null
          created_at?: string | null
          embedding?: string | null
          embedding_text_hash?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          agency?: string | null
          cluster?: string | null
          company_id?: string | null
          created_at?: string | null
          embedding?: string | null
          embedding_text_hash?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "divisions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      general_role_types: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          type: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          type: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          type?: string
        }
        Relationships: []
      }
      general_roles: {
        Row: {
          classification_level: string
          created_at: string
          description: string | null
          embedding: string | null
          function_area: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          classification_level: string
          created_at?: string
          description?: string | null
          embedding?: string | null
          function_area: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          classification_level?: string
          created_at?: string
          description?: string | null
          embedding?: string | null
          function_area?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      institutions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          logo_url: string | null
          name: string
          slug: string
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      job_documents: {
        Row: {
          document_id: string
          document_type: string | null
          document_url: string | null
          job_id: string
          title: string | null
        }
        Insert: {
          document_id: string
          document_type?: string | null
          document_url?: string | null
          job_id: string
          title?: string | null
        }
        Update: {
          document_id?: string
          document_type?: string | null
          document_url?: string | null
          job_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_documents_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_skills: {
        Row: {
          job_id: string
          skill_id: string
        }
        Insert: {
          job_id: string
          skill_id: string
        }
        Update: {
          job_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_skills_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          close_date: string | null
          company_id: string | null
          created_at: string | null
          department: string | null
          department_id: string | null
          embedding: string | null
          embedding_text_hash: string | null
          external_id: string | null
          first_seen_at: string | null
          id: string
          job_type: string | null
          last_updated_at: string | null
          locations: string[] | null
          open_date: string | null
          original_id: string | null
          raw_json: Json | null
          recruiter: Json | null
          remuneration: string | null
          role_id: string | null
          source_id: string | null
          source_url: string | null
          title: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          close_date?: string | null
          company_id?: string | null
          created_at?: string | null
          department?: string | null
          department_id?: string | null
          embedding?: string | null
          embedding_text_hash?: string | null
          external_id?: string | null
          first_seen_at?: string | null
          id?: string
          job_type?: string | null
          last_updated_at?: string | null
          locations?: string[] | null
          open_date?: string | null
          original_id?: string | null
          raw_json?: Json | null
          recruiter?: Json | null
          remuneration?: string | null
          role_id?: string | null
          source_id?: string | null
          source_url?: string | null
          title: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          close_date?: string | null
          company_id?: string | null
          created_at?: string | null
          department?: string | null
          department_id?: string | null
          embedding?: string | null
          embedding_text_hash?: string | null
          external_id?: string | null
          first_seen_at?: string | null
          id?: string
          job_type?: string | null
          last_updated_at?: string | null
          locations?: string[] | null
          open_date?: string | null
          original_id?: string | null
          raw_json?: Json | null
          recruiter?: Json | null
          remuneration?: string | null
          role_id?: string | null
          source_id?: string | null
          source_url?: string | null
          title?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs_history: {
        Row: {
          change_reason: string | null
          change_type: string
          changed_fields: string[] | null
          close_date: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          department: string | null
          department_id: string | null
          description: string | null
          division_id: string | null
          external_id: string
          id: string
          institution_id: string
          job_type: string | null
          locations: string[] | null
          open_date: string | null
          original_id: string
          raw_json: Json | null
          recruiter: Json | null
          remuneration: string | null
          source_id: string
          source_url: string | null
          title: string
          version: number
        }
        Insert: {
          change_reason?: string | null
          change_type: string
          changed_fields?: string[] | null
          close_date?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          department_id?: string | null
          description?: string | null
          division_id?: string | null
          external_id: string
          id: string
          institution_id: string
          job_type?: string | null
          locations?: string[] | null
          open_date?: string | null
          original_id: string
          raw_json?: Json | null
          recruiter?: Json | null
          remuneration?: string | null
          source_id: string
          source_url?: string | null
          title: string
          version: number
        }
        Update: {
          change_reason?: string | null
          change_type?: string
          changed_fields?: string[] | null
          close_date?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          department_id?: string | null
          description?: string | null
          division_id?: string | null
          external_id?: string
          id?: string
          institution_id?: string
          job_type?: string | null
          locations?: string[] | null
          open_date?: string | null
          original_id?: string
          raw_json?: Json | null
          recruiter?: Json | null
          remuneration?: string | null
          source_id?: string
          source_url?: string | null
          title?: string
          version?: number
        }
        Relationships: []
      }
      profile_agent_actions: {
        Row: {
          action_id: string
          profile_id: string
        }
        Insert: {
          action_id: string
          profile_id: string
        }
        Update: {
          action_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_agent_actions_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "agent_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_agent_actions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_capabilities: {
        Row: {
          capability_id: string
          level: string | null
          profile_id: string
          updated_at: string | null
        }
        Insert: {
          capability_id: string
          level?: string | null
          profile_id: string
          updated_at?: string | null
        }
        Update: {
          capability_id?: string
          level?: string | null
          profile_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_capabilities_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_capabilities_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_career_paths: {
        Row: {
          career_path_id: string
          profile_id: string
        }
        Insert: {
          career_path_id: string
          profile_id: string
        }
        Update: {
          career_path_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_career_paths_career_path_id_fkey"
            columns: ["career_path_id"]
            isOneToOne: false
            referencedRelation: "career_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_career_paths_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_job_interactions: {
        Row: {
          interaction_type: string
          job_id: string
          profile_id: string
          timestamp: string | null
        }
        Insert: {
          interaction_type: string
          job_id: string
          profile_id: string
          timestamp?: string | null
        }
        Update: {
          interaction_type?: string
          job_id?: string
          profile_id?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_job_interactions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_job_interactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_skills: {
        Row: {
          evidence: string | null
          profile_id: string
          rating: string | null
          skill_id: string
          updated_at: string | null
        }
        Insert: {
          evidence?: string | null
          profile_id: string
          rating?: string | null
          skill_id: string
          updated_at?: string | null
        }
        Update: {
          evidence?: string | null
          profile_id?: string
          rating?: string | null
          skill_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_skills_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string | null
          division: string | null
          email: string | null
          embedding: string | null
          embedding_text_hash: string | null
          id: string
          last_active: string | null
          name: string | null
          role_title: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          division?: string | null
          email?: string | null
          embedding?: string | null
          embedding_text_hash?: string | null
          id?: string
          last_active?: string | null
          name?: string | null
          role_title?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          division?: string | null
          email?: string | null
          embedding?: string | null
          embedding_text_hash?: string | null
          id?: string
          last_active?: string | null
          name?: string | null
          role_title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      role_capabilities: {
        Row: {
          capability_id: string
          capability_type: string
          level: string | null
          role_id: string
        }
        Insert: {
          capability_id: string
          capability_type: string
          level?: string | null
          role_id: string
        }
        Update: {
          capability_id?: string
          capability_type?: string
          level?: string | null
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_capabilities_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_capabilities_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_documents: {
        Row: {
          document_id: string
          document_type: string | null
          document_url: string | null
          role_id: string
          title: string | null
        }
        Insert: {
          document_id: string
          document_type?: string | null
          document_url?: string | null
          role_id: string
          title?: string | null
        }
        Update: {
          document_id?: string
          document_type?: string | null
          document_url?: string | null
          role_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_documents_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_skills: {
        Row: {
          role_id: string
          skill_id: string
        }
        Insert: {
          role_id: string
          skill_id: string
        }
        Update: {
          role_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_skills_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      role_taxonomies: {
        Row: {
          created_at: string | null
          role_id: string
          taxonomy_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          role_id: string
          taxonomy_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          role_id?: string
          taxonomy_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_taxonomies_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_taxonomies_taxonomy_id_fkey"
            columns: ["taxonomy_id"]
            isOneToOne: false
            referencedRelation: "taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          anzsco_code: string | null
          budget_responsibility: string | null
          company_id: string | null
          created_at: string | null
          date_approved: string | null
          direct_reports: string | null
          division_id: string | null
          embedding: string | null
          embedding_text_hash: string | null
          grade_band: string | null
          id: string
          location: string | null
          pcat_code: string | null
          primary_purpose: string | null
          raw_json: Json | null
          reporting_line: string | null
          source_document_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          anzsco_code?: string | null
          budget_responsibility?: string | null
          company_id?: string | null
          created_at?: string | null
          date_approved?: string | null
          direct_reports?: string | null
          division_id?: string | null
          embedding?: string | null
          embedding_text_hash?: string | null
          grade_band?: string | null
          id?: string
          location?: string | null
          pcat_code?: string | null
          primary_purpose?: string | null
          raw_json?: Json | null
          reporting_line?: string | null
          source_document_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          anzsco_code?: string | null
          budget_responsibility?: string | null
          company_id?: string | null
          created_at?: string | null
          date_approved?: string | null
          direct_reports?: string | null
          division_id?: string | null
          embedding?: string | null
          embedding_text_hash?: string | null
          grade_band?: string | null
          id?: string
          location?: string | null
          pcat_code?: string | null
          primary_purpose?: string | null
          raw_json?: Json | null
          reporting_line?: string | null
          source_document_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          category: string | null
          company_id: string | null
          created_at: string | null
          description: string | null
          embedding: string | null
          embedding_text_hash: string | null
          id: string
          is_occupation_specific: boolean | null
          name: string
          source: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          embedding_text_hash?: string | null
          id?: string
          is_occupation_specific?: boolean | null
          name: string
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          embedding_text_hash?: string | null
          id?: string
          is_occupation_specific?: boolean | null
          name?: string
          source?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      taxonomy: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          taxonomy_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          taxonomy_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          taxonomy_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_job: {
        Args: { p_job_id: string; p_reason: string }
        Returns: undefined
      }
      execute_sql: {
        Args: { sql: string; params: Json }
        Returns: Json
      }
      match_embeddings_by_id: {
        Args: {
          p_query_id: string
          p_table_name: string
          p_match_threshold: number
          p_match_count: number
        }
        Returns: {
          id: string
          similarity: number
        }[]
      }
      match_embeddings_by_vector: {
        Args: {
          p_query_embedding: string
          p_table_name: string
          p_match_threshold: number
          p_match_count: number
        }
        Returns: {
          id: string
          similarity: number
        }[]
      }
    }
    Enums: {
      ai_invocation_status: "success" | "error" | "timeout"
      ai_model_provider: "openai" | "google" | "anthropic"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ai_invocation_status: ["success", "error", "timeout"],
      ai_model_provider: ["openai", "google", "anthropic"],
    },
  },
} as const
