'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ProtectedPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    getUser()
  }, [])

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Protected Page</h1>
      {user ? (
        <div>
          <p className="text-lg">Authenticated ✓</p>
          <p className="mt-2">User: {user.email}</p>
        </div>
      ) : (
        <p className="text-lg">Not authenticated</p>
      )}
    </div>
  )
}
