import Link from 'next/link'
import AppShell from '@/app/components/AppShell'
import { CheckReport } from '@/app/components/check/CheckReport'
import { CheckActions } from '@/app/components/check/CheckActions'
import { Card } from '@/app/components/ui'
import { getCheck } from '@/lib/checkStore'

export const dynamic = 'force-dynamic'

export default async function CheckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const check = await getCheck(id)
  const previous = check?.previousId ? await getCheck(check.previousId) : null

  return (
    <AppShell>
      {check ? (
        <>
          <CheckActions id={check.id} url={check.result.finalUrl} />
          <CheckReport check={check} previous={previous} internal />
        </>
      ) : (
        <Card className="p-8 max-w-[560px]">
          <h1 className="text-[18px] font-semibold">Check nicht gefunden</h1>
          <p className="text-[14px] text-muted-foreground mt-2 leading-relaxed">
            Entweder ist die Adresse unvollständig, oder der Check ist nach einem Jahr abgelaufen.
          </p>
          <Link href="/" className="inline-block mt-4 text-[14px] font-medium text-primary hover:underline">Neuen Check starten</Link>
        </Card>
      )}
    </AppShell>
  )
}
