/**
 * PostgREST caps every response at db-max-rows (1000 on this project), so a
 * single .range(0,4999) still returns only 1000 rows. This pages through in
 * 1000-row chunks until everything is fetched.
 *
 * Pass a factory that builds a fresh ordered query for a given range, e.g.
 *   fetchAllRows((from, to) => supabase.from('brands').select('*').order('name').range(from, to))
 */
const CHUNK = 1000

export async function fetchAllRows<T>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await makeQuery(from, from + CHUNK - 1)
    if (error || !data || data.length === 0) break
    all.push(...data)
    if (data.length < CHUNK) break
    if (from > 100000) break // hard safety stop
  }
  return all
}
