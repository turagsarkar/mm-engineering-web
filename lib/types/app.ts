export type TrafficLight = 'green' | 'amber' | 'red' | null

export type UserRole = 'admin' | 'member'

export interface AppUser {
  id: string
  email: string
  role: UserRole
  full_name: string | null
}

export type SupplierWithBrand = {
  id: string
  brand_id: string
  brand_name: string
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
  traffic_light: TrafficLight
}

export type BrandWithSuppliers = {
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
  suppliers: SupplierWithBrand[]
}
