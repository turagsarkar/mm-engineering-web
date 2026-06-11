export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'admin' | 'member'
          is_active: boolean
          last_login: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: 'admin' | 'member'
          is_active?: boolean
          last_login?: string | null
        }
        Update: {
          email?: string
          full_name?: string | null
          role?: 'admin' | 'member'
          is_active?: boolean
          last_login?: string | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          id: string
          name: string
          slug: string
          aliases: string[] | null
          notification_text: string | null
          notification_type: string | null
          ai_do_not_quote: boolean
          confirmed_suppliers: boolean
          review_interval_months: number
          last_reviewed_at: string | null
          reviewed_by: string | null
          review_disabled: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          aliases?: string[] | null
          notification_text?: string | null
          notification_type?: string | null
          ai_do_not_quote?: boolean
          confirmed_suppliers?: boolean
          review_interval_months?: number
          last_reviewed_at?: string | null
          reviewed_by?: string | null
          review_disabled?: boolean
          created_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          aliases?: string[] | null
          notification_text?: string | null
          notification_type?: string | null
          ai_do_not_quote?: boolean
          confirmed_suppliers?: boolean
          review_interval_months?: number
          last_reviewed_at?: string | null
          reviewed_by?: string | null
          review_disabled?: boolean
          created_by?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          id: string
          brand_id: string
          name: string
          email: string | null
          contact_name: string | null
          margin: string | null
          where_to_look: string | null
          po_number: string | null
          priority_rank: number
          ai_approved: boolean
          ai_usage_counter: number
          review_required: boolean
          supplier_status: string
          traffic_light: string | null
          added_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          name: string
          email?: string | null
          contact_name?: string | null
          margin?: string | null
          where_to_look?: string | null
          po_number?: string | null
          priority_rank?: number
          ai_approved?: boolean
          ai_usage_counter?: number
          review_required?: boolean
          supplier_status?: string
          traffic_light?: string | null
          added_by?: string | null
        }
        Update: {
          id?: string
          brand_id?: string
          name?: string
          email?: string | null
          contact_name?: string | null
          margin?: string | null
          where_to_look?: string | null
          po_number?: string | null
          priority_rank?: number
          ai_approved?: boolean
          ai_usage_counter?: number
          review_required?: boolean
          supplier_status?: string
          traffic_light?: string | null
          added_by?: string | null
        }
        Relationships: []
      }
      supplier_notes: {
        Row: {
          id: string
          supplier_id: string
          note_type: string | null
          note_text: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          supplier_id: string
          note_type?: string | null
          note_text: string
          created_by?: string | null
        }
        Update: {
          note_type?: string | null
          note_text?: string
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          id: string
          user_id: string | null
          user_name: string | null
          action_type: string
          entity_type: string
          entity_id: string | null
          entity_name: string | null
          details: Json | null
          created_at: string
        }
        Insert: {
          user_id?: string | null
          user_name?: string | null
          action_type: string
          entity_type: string
          entity_id?: string | null
          entity_name?: string | null
          details?: Json | null
        }
        Update: {
          action_type?: string
        }
        Relationships: []
      }
      priority_tasks: {
        Row: {
          id: string
          brand_id: string | null
          message: string
          set_by: string | null
          set_at: string
          due_date: string | null
          priority: 'low' | 'normal' | 'high' | 'urgent'
          is_active: boolean
          completed_by: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          brand_id?: string | null
          message: string
          set_by?: string | null
          due_date?: string | null
          priority?: 'low' | 'normal' | 'high' | 'urgent'
          is_active?: boolean
          completed_by?: string | null
          completed_at?: string | null
        }
        Update: {
          brand_id?: string | null
          message?: string
          priority?: 'low' | 'normal' | 'high' | 'urgent'
          due_date?: string | null
          is_active?: boolean
          completed_by?: string | null
          completed_at?: string | null
        }
        Relationships: []
      }
      price_comparisons: {
        Row: {
          id: string
          brand_id: string
          part_number: string
          description: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          part_number: string
          description?: string | null
          created_by?: string | null
        }
        Update: {
          description?: string | null
        }
        Relationships: []
      }
      price_comparison_lines: {
        Row: {
          id: string
          comparison_id: string
          supplier_id: string | null
          supplier_name: string | null
          supplier_email: string | null
          price: number | null
          currency: string
          lead_time: string | null
          response_time: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          comparison_id: string
          supplier_id?: string | null
          supplier_name?: string | null
          supplier_email?: string | null
          price?: number | null
          currency?: string
          lead_time?: string | null
          response_time?: string | null
          notes?: string | null
        }
        Update: {
          price?: number | null
          lead_time?: string | null
          response_time?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      enquiry_log: {
        Row: {
          id: string
          supplier_id: string | null
          brand_id: string | null
          rfq_reference: string | null
          subject: string | null
          sent_at: string | null
          status: string | null
          margin: string | null
          created_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      manual_review_queue: {
        Row: {
          id: string
          supplier_id: string | null
          brand_id: string | null
          reason_code: string | null
          email_subject: string | null
          email_body: string | null
          resolved: boolean
          resolved_by: string | null
          resolved_at: string | null
          created_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
    }
    Views: {
      v_ai_eligible_suppliers: {
        Row: {
          id: string
          brand_id: string
          brand_name: string
          supplier_name: string
          email: string | null
          priority_rank: number
          margin: string | null
        }
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type Brand = Tables<'brands'>
export type Supplier = Tables<'suppliers'>
export type Profile = Tables<'profiles'>
export type SupplierNote = Tables<'supplier_notes'>
export type ActivityLog = Tables<'activity_log'>
export type PriorityTask = Tables<'priority_tasks'>
export type PriceComparison = Tables<'price_comparisons'>
export type PriceComparisonLine = Tables<'price_comparison_lines'>
