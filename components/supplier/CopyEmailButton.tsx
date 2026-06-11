'use client'
import { useState } from 'react'
import { Mail, Check } from 'lucide-react'

export function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(email)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      title="Click to copy"
      className="flex items-center gap-1.5 text-gray-900 hover:text-blue-600 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Mail className="h-3.5 w-3.5 text-gray-400" />}
      <span className={copied ? 'text-green-600' : ''}>{copied ? 'Copied!' : email}</span>
    </button>
  )
}
