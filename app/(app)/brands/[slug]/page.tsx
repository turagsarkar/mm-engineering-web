import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BrandDetailClient } from './BrandDetailClient'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function BrandDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: brand } = await supabase
    .from('brands')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!brand) notFound()

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('*')
    .eq('brand_id', brand.id)
    .order('priority_rank', { ascending: true })
    .order('name', { ascending: true })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title={brand.name} />
      <BrandDetailClient brand={brand} initialSuppliers={suppliers ?? []} />
    </div>
  )
}
