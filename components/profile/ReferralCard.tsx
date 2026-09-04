"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Gift } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function ReferralCard({ referralCode, referralCount }: { referralCode: string; referralCount: number }) {
  const [copied, setCopied] = useState(false)
  const [referralLink, setReferralLink] = useState(`/r/${referralCode}`)

  useEffect(() => {
    setReferralLink(`${window.location.origin}/r/${referralCode}`)
  }, [referralCode])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralLink)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Gift className="h-5 w-5" />
          Пригласи друга
        </CardTitle>
        <CardDescription>
          Вы и ваш друг получите по 2000 монет за регистрацию по вашей ссылке.
        </CardDescription>
        <p className="mt-2 text-sm font-medium text-foreground">
          Рефералов приглашено: {referralCount}
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex justify-center rounded-lg border bg-white p-3">
            <QRCodeSVG
              value={referralLink}
              size={144}
              level="M"
              includeMargin
              aria-label="QR-код реферальной ссылки"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm text-muted-foreground">
              Отсканируйте QR-код или скопируйте ссылку:
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={referralLink}
                aria-label="Реферальная ссылка"
                className="min-w-0 flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-sm text-foreground outline-none"
              />
              <Button onClick={handleCopy} size="sm" variant="secondary">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                <span className="ml-1.5">{copied ? "Скопировано" : "Копировать"}</span>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
