import { requireAdminAuth } from '@/lib/auth-check'
import { apiOk } from '@/lib/api/response'
import { getComparisonReport } from '@/lib/baremes-autonome/service'
import { rateFailure } from '@/lib/baremes-autonome/http'
export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
  const auth=await requireAdminAuth()
  if(!auth.isAuthorized)return auth.error
  try{return apiOk(await getComparisonReport((await context.params).id),{headers:{'Cache-Control':'private, no-store','Content-Disposition':'attachment; filename="docbel-verification.json"'}})}catch(error){return rateFailure(error)}
}
