"use client"

import { useRouter } from "next/navigation"
import { AuthModal } from "@/components/auth/auth-modal"

export default function RegisterPage() {
  const router = useRouter()

  return (
    <AuthModal
      isOpen
      initialMode="register"
      onClose={() => router.push("/")}
    />
  )
}
