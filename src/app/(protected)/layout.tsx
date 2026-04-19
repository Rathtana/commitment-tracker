import type { ReactNode } from "react"

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-4 px-4 py-8 md:py-12">
      {children}
    </main>
  )
}
