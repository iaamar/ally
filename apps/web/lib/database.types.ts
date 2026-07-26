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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_heartbeats: {
        Row: {
          agent_id: string
          id: string
          last_seen_at: string
          metadata: Json
          org_id: string
          project_name: string
        }
        Insert: {
          agent_id: string
          id?: string
          last_seen_at?: string
          metadata?: Json
          org_id: string
          project_name?: string
        }
        Update: {
          agent_id?: string
          id?: string
          last_seen_at?: string
          metadata?: Json
          org_id?: string
          project_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_heartbeats_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          org_id: string
          prefix: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          org_id: string
          prefix: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          org_id?: string
          prefix?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      findings: {
        Row: {
          cluster_key: string
          confidence: string
          file: string
          fingerprint: string
          fix_class: string
          id: string
          level: string
          line: number
          match_key: string | null
          message: string
          ordinal: number | null
          position: number
          rule_id: string
          scan_id: string
          severity: string
          snippet: string
          status: string
          wcag: string[]
        }
        Insert: {
          cluster_key?: string
          confidence: string
          file?: string
          fingerprint: string
          fix_class: string
          id?: string
          level: string
          line?: number
          match_key?: string | null
          message?: string
          ordinal?: number | null
          position?: number
          rule_id: string
          scan_id: string
          severity: string
          snippet?: string
          status?: string
          wcag?: string[]
        }
        Update: {
          cluster_key?: string
          confidence?: string
          file?: string
          fingerprint?: string
          fix_class?: string
          id?: string
          level?: string
          line?: number
          match_key?: string | null
          message?: string
          ordinal?: number | null
          position?: number
          rule_id?: string
          scan_id?: string
          severity?: string
          snippet?: string
          status?: string
          wcag?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "findings_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_run_events: {
        Row: {
          created_at: string
          detail: Json
          event_key: string
          id: number
          message: string
          progress: number
          run_id: string
          stage: string
          status: string
          total: number
        }
        Insert: {
          created_at?: string
          detail?: Json
          event_key: string
          id?: never
          message?: string
          progress?: number
          run_id: string
          stage: string
          status: string
          total?: number
        }
        Update: {
          created_at?: string
          detail?: Json
          event_key?: string
          id?: never
          message?: string
          progress?: number
          run_id?: string
          stage?: string
          status?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "mcp_run_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "mcp_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_runs: {
        Row: {
          api_key_id: string | null
          client_name: string | null
          completed_at: string | null
          contract_id: string | null
          current_stage: string
          duration_ms: number | null
          error_category: string | null
          error_message: string | null
          id: string
          kind: string
          message: string
          org_id: string
          parent_run_id: string | null
          progress: number
          project_id: string | null
          request_id: string | null
          started_at: string
          status: string
          tool_name: string | null
          total: number
          updated_at: string
        }
        Insert: {
          api_key_id?: string | null
          client_name?: string | null
          completed_at?: string | null
          contract_id?: string | null
          current_stage?: string
          duration_ms?: number | null
          error_category?: string | null
          error_message?: string | null
          id?: string
          kind: string
          message?: string
          org_id: string
          parent_run_id?: string | null
          progress?: number
          project_id?: string | null
          request_id?: string | null
          started_at?: string
          status?: string
          tool_name?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          api_key_id?: string | null
          client_name?: string | null
          completed_at?: string | null
          contract_id?: string | null
          current_stage?: string
          duration_ms?: number | null
          error_category?: string | null
          error_message?: string | null
          id?: string
          kind?: string
          message?: string
          org_id?: string
          parent_run_id?: string | null
          progress?: number
          project_id?: string | null
          request_id?: string | null
          started_at?: string
          status?: string
          tool_name?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_runs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_runs_parent_run_id_fkey"
            columns: ["parent_run_id"]
            isOneToOne: false
            referencedRelation: "mcp_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      remediation_attempts: {
        Row: {
          changed_files: Json
          contract_row_id: string
          created_at: string
          feedback: string
          id: string
          n: number
          progress_signature: string
          result: Json
          verdict: string
        }
        Insert: {
          changed_files?: Json
          contract_row_id: string
          created_at?: string
          feedback?: string
          id?: string
          n: number
          progress_signature?: string
          result?: Json
          verdict: string
        }
        Update: {
          changed_files?: Json
          contract_row_id?: string
          created_at?: string
          feedback?: string
          id?: string
          n?: number
          progress_signature?: string
          result?: Json
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "remediation_attempts_contract_row_id_fkey"
            columns: ["contract_row_id"]
            isOneToOne: false
            referencedRelation: "remediation_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      remediation_contracts: {
        Row: {
          acceptance: Json
          baseline: Json
          contract_id: string
          created_at: string
          guidance: string
          id: string
          knowledge: Json
          org_id: string
          project_name: string
          run_id: string | null
          scope: Json
          targets: Json
          workflow_run_id: string | null
        }
        Insert: {
          acceptance: Json
          baseline: Json
          contract_id: string
          created_at?: string
          guidance?: string
          id?: string
          knowledge?: Json
          org_id: string
          project_name?: string
          run_id?: string | null
          scope: Json
          targets: Json
          workflow_run_id?: string | null
        }
        Update: {
          acceptance?: Json
          baseline?: Json
          contract_id?: string
          created_at?: string
          guidance?: string
          id?: string
          knowledge?: Json
          org_id?: string
          project_name?: string
          run_id?: string | null
          scope?: Json
          targets?: Json
          workflow_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remediation_contracts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remediation_contracts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "remediation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remediation_contracts_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: false
            referencedRelation: "mcp_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      remediation_runs: {
        Row: {
          contract_id: string | null
          created_at: string
          id: string
          kind: string
          org_id: string
          project_name: string
          score_after: number | null
          score_before: number | null
          status: string
          targets_resolved: number
          targets_total: number
          updated_at: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          id?: string
          kind: string
          org_id: string
          project_name?: string
          score_after?: number | null
          score_before?: number | null
          status?: string
          targets_resolved?: number
          targets_total?: number
          updated_at?: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          org_id?: string
          project_name?: string
          score_after?: number | null
          score_before?: number | null
          status?: string
          targets_resolved?: number
          targets_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "remediation_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      run_events: {
        Row: {
          created_at: string
          detail: Json
          id: string
          label: string
          phase: string
          run_id: string
          seq: number
          status: string
        }
        Insert: {
          created_at?: string
          detail?: Json
          id?: string
          label?: string
          phase: string
          run_id: string
          seq?: number
          status: string
        }
        Update: {
          created_at?: string
          detail?: Json
          id?: string
          label?: string
          phase?: string
          run_id?: string
          seq?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "remediation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_requests: {
        Row: {
          claimed_by: string | null
          created_at: string
          expires_at: string
          id: string
          org_id: string
          params: Json
          project_name: string
          requested_by: string | null
          run_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          claimed_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          org_id: string
          params?: Json
          project_name?: string
          requested_by?: string | null
          run_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          claimed_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          org_id?: string
          params?: Json
          project_name?: string
          requested_by?: string | null
          run_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_requests_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "remediation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      scans: {
        Row: {
          created_at: string
          files_scanned: number
          id: string
          project_id: string
          score: number
          summary: Json
          tool_version: string
        }
        Insert: {
          created_at?: string
          files_scanned?: number
          id?: string
          project_id: string
          score?: number
          summary?: Json
          tool_version?: string
        }
        Update: {
          created_at?: string
          files_scanned?: number
          id?: string
          project_id?: string
          score?: number
          summary?: Json
          tool_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "scans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      wcag_chunks: {
        Row: {
          chunk_index: number
          conformance_level: string | null
          content: string
          created_at: string
          criterion_id: string | null
          document_id: string
          embedding: unknown
          embedding_model: string
          fts: unknown
          id: string
          metadata: Json
          principle: string | null
          source_url: string | null
          token_count: number
          topic: string | null
          wcag_version: string | null
        }
        Insert: {
          chunk_index: number
          conformance_level?: string | null
          content: string
          created_at?: string
          criterion_id?: string | null
          document_id: string
          embedding?: unknown
          embedding_model?: string
          fts?: unknown
          id?: string
          metadata?: Json
          principle?: string | null
          source_url?: string | null
          token_count: number
          topic?: string | null
          wcag_version?: string | null
        }
        Update: {
          chunk_index?: number
          conformance_level?: string | null
          content?: string
          created_at?: string
          criterion_id?: string | null
          document_id?: string
          embedding?: unknown
          embedding_model?: string
          fts?: unknown
          id?: string
          metadata?: Json
          principle?: string | null
          source_url?: string | null
          token_count?: number
          topic?: string | null
          wcag_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wcag_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "wcag_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      wcag_documents: {
        Row: {
          content_hash: string
          doc_type: string
          id: string
          raw_markdown: string
          scraped_at: string
          source_url: string
          title: string
          updated_at: string
          wcag_version: string | null
        }
        Insert: {
          content_hash: string
          doc_type: string
          id?: string
          raw_markdown: string
          scraped_at?: string
          source_url: string
          title: string
          updated_at?: string
          wcag_version?: string | null
        }
        Update: {
          content_hash?: string
          doc_type?: string
          id?: string
          raw_markdown?: string
          scraped_at?: string
          source_url?: string
          title?: string
          updated_at?: string
          wcag_version?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      hybrid_search_wcag: {
        Args: {
          filter_criteria?: string[]
          filter_doc_types?: string[]
          filter_levels?: string[]
          filter_version?: string
          match_count?: number
          query_embedding: unknown
          query_text: string
          rrf_k?: number
        }
        Returns: {
          conformance_level: string
          content: string
          criterion_id: string
          id: string
          metadata: Json
          score: number
          source_url: string
          wcag_version: string
        }[]
      }
      lexical_search_wcag: {
        Args: {
          filter_criteria?: string[]
          filter_doc_types?: string[]
          filter_levels?: string[]
          filter_version?: string
          match_count?: number
          query_text: string
        }
        Returns: {
          conformance_level: string
          content: string
          criterion_id: string
          id: string
          metadata: Json
          score: number
          source_url: string
          wcag_version: string
        }[]
      }
      match_wcag_chunks: {
        Args: {
          filter_doc_types?: string[]
          filter_levels?: string[]
          filter_version?: string
          match_count?: number
          query_embedding: unknown
          similarity_cutoff?: number
        }
        Returns: {
          conformance_level: string
          content: string
          criterion_id: string
          id: string
          metadata: Json
          similarity: number
          source_url: string
          wcag_version: string
        }[]
      }
      wcag_extract_criteria: { Args: { query_text: string }; Returns: string[] }
      wcag_or_tsquery: { Args: { query_text: string }; Returns: unknown }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
