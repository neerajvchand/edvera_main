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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      action_items: {
        Row: {
          category: string
          created_at: string
          description: string | null
          due_at: string | null
          event_at: string | null
          expires_at: string | null
          id: string
          requires_action: boolean | null
          severity: number | null
          snoozed_until: string | null
          source_confidence: number | null
          source_kind: string
          source_label: string | null
          source_url: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          event_at?: string | null
          expires_at?: string | null
          id?: string
          requires_action?: boolean | null
          severity?: number | null
          snoozed_until?: string | null
          source_confidence?: number | null
          source_kind?: string
          source_label?: string | null
          source_url?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          event_at?: string | null
          expires_at?: string | null
          id?: string
          requires_action?: boolean | null
          severity?: number | null
          snoozed_until?: string | null
          source_confidence?: number | null
          source_kind?: string
          source_label?: string | null
          source_url?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          school_id: string
          starts_at: string
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          school_id: string
          starts_at?: string
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          school_id?: string
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_entries: {
        Row: {
          attendance_date: string
          child_id: string
          created_at: string
          id: string
          period: string | null
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attendance_date: string
          child_id: string
          created_at?: string
          id?: string
          period?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          child_id?: string
          created_at?: string
          id?: string
          period?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_entries_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_triage: {
        Row: {
          admin_note: string | null
          attendance_date: string
          child_id: string
          created_at: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          school_id: string
          source_attendance_entry_id: string | null
          submitted_by_user_id: string | null
          submitted_reason: string | null
          submitted_status: string
          triage_status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          attendance_date: string
          child_id: string
          created_at?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          school_id: string
          source_attendance_entry_id?: string | null
          submitted_by_user_id?: string | null
          submitted_reason?: string | null
          submitted_status: string
          triage_status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          attendance_date?: string
          child_id?: string
          created_at?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          school_id?: string
          source_attendance_entry_id?: string | null
          submitted_by_user_id?: string | null
          submitted_reason?: string | null
          submitted_status?: string
          triage_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_triage_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          meta: Json
          school_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          meta?: Json
          school_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          meta?: Json
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      bell_blocks: {
        Row: {
          bell_schedule_id: string
          created_at: string
          end_local: string
          id: string
          label: string
          sort_order: number
          start_local: string
        }
        Insert: {
          bell_schedule_id: string
          created_at?: string
          end_local: string
          id?: string
          label: string
          sort_order: number
          start_local: string
        }
        Update: {
          bell_schedule_id?: string
          created_at?: string
          end_local?: string
          id?: string
          label?: string
          sort_order?: number
          start_local?: string
        }
        Relationships: [
          {
            foreignKeyName: "bell_blocks_bell_schedule_id_fkey"
            columns: ["bell_schedule_id"]
            isOneToOne: false
            referencedRelation: "bell_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      bell_schedules: {
        Row: {
          created_at: string
          effective_end: string | null
          effective_start: string | null
          id: string
          schedule_name: string
          school_id: string
          weekdays: number[] | null
        }
        Insert: {
          created_at?: string
          effective_end?: string | null
          effective_start?: string | null
          id?: string
          schedule_name: string
          school_id: string
          weekdays?: number[] | null
        }
        Update: {
          created_at?: string
          effective_end?: string | null
          effective_start?: string | null
          id?: string
          schedule_name?: string
          school_id?: string
          weekdays?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "bell_schedules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      board_meetings: {
        Row: {
          affects_policy: boolean
          affects_safety: boolean
          affects_schedule: boolean
          affects_students: boolean
          created_at: string
          detected_at: string | null
          district_id: string
          external_id: string | null
          id: string
          impact_summary: string | null
          key_topics: string[] | null
          meeting_date: string
          relevance_score: number
          source_url: string | null
          status: string
          summary_short: string | null
          title: string
          updated_at: string
        }
        Insert: {
          affects_policy?: boolean
          affects_safety?: boolean
          affects_schedule?: boolean
          affects_students?: boolean
          created_at?: string
          detected_at?: string | null
          district_id: string
          external_id?: string | null
          id?: string
          impact_summary?: string | null
          key_topics?: string[] | null
          meeting_date: string
          relevance_score?: number
          source_url?: string | null
          status?: string
          summary_short?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          affects_policy?: boolean
          affects_safety?: boolean
          affects_schedule?: boolean
          affects_students?: boolean
          created_at?: string
          detected_at?: string | null
          district_id?: string
          external_id?: string | null
          id?: string
          impact_summary?: string | null
          key_topics?: string[] | null
          meeting_date?: string
          relevance_score?: number
          source_url?: string | null
          status?: string
          summary_short?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_meetings_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          archived_at: string | null
          created_at: string
          display_name: string
          district_id: string | null
          grade_level: string
          id: string
          is_active: boolean
          parent_id: string
          school_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          display_name: string
          district_id?: string | null
          grade_level: string
          id?: string
          is_active?: boolean
          parent_id: string
          school_id?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          display_name?: string
          district_id?: string | null
          grade_level?: string
          id?: string
          is_active?: boolean
          parent_id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "children_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      day_overrides: {
        Row: {
          created_at: string
          date: string
          day_type: string
          id: string
          notes: string | null
          pickup_time_local: string | null
          school_id: string
          start_time_local: string | null
        }
        Insert: {
          created_at?: string
          date: string
          day_type: string
          id?: string
          notes?: string | null
          pickup_time_local?: string | null
          school_id: string
          start_time_local?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          day_type?: string
          id?: string
          notes?: string | null
          pickup_time_local?: string | null
          school_id?: string
          start_time_local?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "day_overrides_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      district_sources: {
        Row: {
          created_at: string
          district_id: string
          id: string
          is_active: boolean
          label: string | null
          last_checked_at: string | null
          last_hash: string | null
          source_type: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          district_id: string
          id?: string
          is_active?: boolean
          label?: string | null
          last_checked_at?: string | null
          last_hash?: string | null
          source_type?: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          district_id?: string
          id?: string
          is_active?: boolean
          label?: string | null
          last_checked_at?: string | null
          last_hash?: string | null
          source_type?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "district_sources_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      districts: {
        Row: {
          board_url: string | null
          created_at: string
          id: string
          name: string
          state: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          board_url?: string | null
          created_at?: string
          id?: string
          name: string
          state?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          board_url?: string | null
          created_at?: string
          id?: string
          name?: string
          state?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      doc_audit_events: {
        Row: {
          created_at: string
          document_id: string
          id: string
          message: string
          payload_json: Json
          stage: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          message?: string
          payload_json?: Json
          stage: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          message?: string
          payload_json?: Json
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_audit_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          created_at: string
          document_id: string
          id: string
          page_number: number | null
          section_heading: string | null
          text: string
        }
        Insert: {
          chunk_index: number
          created_at?: string
          document_id: string
          id?: string
          page_number?: number | null
          section_heading?: string | null
          text: string
        }
        Update: {
          chunk_index?: number
          created_at?: string
          document_id?: string
          id?: string
          page_number?: number | null
          section_heading?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_outputs: {
        Row: {
          action_items_json: Json
          citations_json: Json
          created_at: string
          document_id: string
          id: string
          memo_text: string
          risks_json: Json
        }
        Insert: {
          action_items_json?: Json
          citations_json?: Json
          created_at?: string
          document_id: string
          id?: string
          memo_text?: string
          risks_json?: Json
        }
        Update: {
          action_items_json?: Json
          citations_json?: Json
          created_at?: string
          document_id?: string
          id?: string
          memo_text?: string
          risks_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "document_outputs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          audience: string
          created_at: string
          doc_type: string
          file_path: string
          filename: string
          id: string
          status: string
          strict_mode: boolean
          tone: string
          uploader_id: string
        }
        Insert: {
          audience?: string
          created_at?: string
          doc_type?: string
          file_path: string
          filename: string
          id?: string
          status?: string
          strict_mode?: boolean
          tone?: string
          uploader_id: string
        }
        Update: {
          audience?: string
          created_at?: string
          doc_type?: string
          file_path?: string
          filename?: string
          id?: string
          status?: string
          strict_mode?: boolean
          tone?: string
          uploader_id?: string
        }
        Relationships: []
      }
      ingestion_runs: {
        Row: {
          completed_at: string | null
          id: string
          last_error: string | null
          run_type: string
          schools_attempted: number
          schools_failed: number
          schools_succeeded: number
          started_at: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          last_error?: string | null
          run_type?: string
          schools_attempted?: number
          schools_failed?: number
          schools_succeeded?: number
          started_at?: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          last_error?: string | null
          run_type?: string
          schools_attempted?: number
          schools_failed?: number
          schools_succeeded?: number
          started_at?: string
        }
        Relationships: []
      }
      insight_impressions: {
        Row: {
          id: string
          insight_id: string
          school_id: string
          seen_at: string
          user_id: string
        }
        Insert: {
          id?: string
          insight_id: string
          school_id: string
          seen_at?: string
          user_id: string
        }
        Update: {
          id?: string
          insight_id?: string
          school_id?: string
          seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insight_impressions_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "insights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insight_impressions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      insights: {
        Row: {
          category: string
          context: string
          created_at: string
          headline: string
          id: string
          insight_key: string
          is_active: boolean
          last_updated: string
          mini_viz_type: string
          payload: Json
          severity: string
          source: string
          why_this: string
        }
        Insert: {
          category: string
          context: string
          created_at?: string
          headline: string
          id?: string
          insight_key: string
          is_active?: boolean
          last_updated?: string
          mini_viz_type?: string
          payload?: Json
          severity?: string
          source?: string
          why_this: string
        }
        Update: {
          category?: string
          context?: string
          created_at?: string
          headline?: string
          id?: string
          insight_key?: string
          is_active?: boolean
          last_updated?: string
          mini_viz_type?: string
          payload?: Json
          severity?: string
          source?: string
          why_this?: string
        }
        Relationships: []
      }
      legal_pages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean
          slug: string
          summary: string | null
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          slug: string
          summary?: string | null
          title: string
          updated_at?: string
          version?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          slug?: string
          summary?: string | null
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          created_at: string
          district_id: string | null
          id: string
          role: string
          school_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          district_id?: string | null
          id?: string
          role?: string
          school_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          district_id?: string | null
          id?: string
          role?: string
          school_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          child_id: string | null
          content: string
          created_at: string
          id: string
          parent_id: string
          pinned: boolean
          school_id: string
          updated_at: string
        }
        Insert: {
          child_id?: string | null
          content: string
          created_at?: string
          id?: string
          parent_id: string
          pinned?: boolean
          school_id: string
          updated_at?: string
        }
        Update: {
          child_id?: string | null
          content?: string
          created_at?: string
          id?: string
          parent_id?: string
          pinned?: boolean
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          has_completed_onboarding: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          has_completed_onboarding?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          has_completed_onboarding?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      school_events: {
        Row: {
          all_day: boolean
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string | null
          id: string
          last_seen_at: string
          location: string | null
          school_id: string
          source: string
          source_event_id: string | null
          start_time: string
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          all_day?: boolean
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          last_seen_at?: string
          location?: string | null
          school_id: string
          source: string
          source_event_id?: string | null
          start_time: string
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          all_day?: boolean
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          last_seen_at?: string
          location?: string | null
          school_id?: string
          source?: string
          source_event_id?: string | null
          start_time?: string
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_insights: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          insight_id: string
          priority_score: number
          school_id: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          insight_id: string
          priority_score?: number
          school_id: string
          start_date?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          insight_id?: string
          priority_score?: number
          school_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_insights_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "insights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_insights_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_profiles: {
        Row: {
          bell_schedule_rules: Json
          contacts: Json
          id: string
          quick_links: Json
          school_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bell_schedule_rules?: Json
          contacts?: Json
          id?: string
          quick_links?: Json
          school_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bell_schedule_rules?: Json
          contacts?: Json
          id?: string
          quick_links?: Json
          school_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          attendance_extension: string | null
          attendance_phone: string | null
          bell_schedule_url: string | null
          calendar_feed_url: string | null
          calendar_page_url: string | null
          cds_code: string | null
          county_name: string | null
          created_at: string
          district_id: string | null
          district_name: string | null
          id: string
          name: string
          slug: string | null
          timezone: string
        }
        Insert: {
          attendance_extension?: string | null
          attendance_phone?: string | null
          bell_schedule_url?: string | null
          calendar_feed_url?: string | null
          calendar_page_url?: string | null
          cds_code?: string | null
          county_name?: string | null
          created_at?: string
          district_id?: string | null
          district_name?: string | null
          id?: string
          name: string
          slug?: string | null
          timezone?: string
        }
        Update: {
          attendance_extension?: string | null
          attendance_phone?: string | null
          bell_schedule_url?: string | null
          calendar_feed_url?: string | null
          calendar_page_url?: string | null
          cds_code?: string | null
          county_name?: string | null
          created_at?: string
          district_id?: string | null
          district_name?: string | null
          id?: string
          name?: string
          slug?: string | null
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "schools_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_memberships: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          role: string
          school_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          role?: string
          school_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          role?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      todos: {
        Row: {
          child_id: string | null
          created_at: string
          details: string | null
          due_date: string | null
          id: string
          parent_id: string
          school_id: string
          source: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          child_id?: string | null
          created_at?: string
          details?: string | null
          due_date?: string | null
          id?: string
          parent_id: string
          school_id: string
          source?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          child_id?: string | null
          created_at?: string
          details?: string | null
          due_date?: string | null
          id?: string
          parent_id?: string
          school_id?: string
          source?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "todos_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_coming_up: {
        Args: { p_limit?: number; p_school_id: string }
        Returns: {
          all_day: boolean
          category: string
          description: string
          end_time: string
          id: string
          location: string
          start_time: string
          title: string
        }[]
      }
      get_current_insight_for_school: {
        Args: { p_school_id: string; p_user_id?: string }
        Returns: {
          category: string
          context: string
          headline: string
          insight_id: string
          insight_key: string
          last_updated: string
          mini_viz_type: string
          payload: Json
          priority_score: number
          school_insight_id: string
          severity: string
          source: string
          why_this: string
        }[]
      }
      get_today_at_a_glance: {
        Args: { p_date?: string; p_school_id: string }
        Returns: Json
      }
      get_todays_schedule: {
        Args: { p_date?: string; p_school_id: string }
        Returns: {
          end_local: string
          label: string
          sort_order: number
          start_local: string
        }[]
      }
      has_membership_role: {
        Args: {
          _district_id?: string
          _role: string
          _school_id?: string
          _user_id: string
        }
        Returns: boolean
      }
      is_active_staff: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      link_school_district: {
        Args: { p_district_name: string; p_school_id: string }
        Returns: string
      }
      run_calendar_ingestion: { Args: never; Returns: undefined }
      user_has_school_access: {
        Args: { p_school_id: string; p_user_id: string }
        Returns: boolean
      }
      user_owns_child: {
        Args: { p_child_id: string; p_user_id: string }
        Returns: boolean
      }
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
