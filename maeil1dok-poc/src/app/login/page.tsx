export default function LoginPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const redirectTo = encodeURIComponent(`${siteUrl}/auth/callback`)

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">로그인</h1>
      <div className="space-y-4">
        <a
          href={`${supabaseUrl}/auth/v1/authorize?provider=kakao&redirect_to=${redirectTo}`}
          className="block w-full px-4 py-2 bg-yellow-300 text-black rounded font-semibold text-center"
        >
          Kakao로 로그인
        </a>
        <a
          href={`${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`}
          className="block w-full px-4 py-2 bg-white border border-gray-300 text-black rounded font-semibold text-center"
        >
          Google로 로그인
        </a>
        <a
          href={`${supabaseUrl}/auth/v1/authorize?provider=apple&redirect_to=${redirectTo}`}
          className="block w-full px-4 py-2 bg-black text-white rounded font-semibold text-center"
        >
          Apple로 로그인
        </a>
      </div>
      <p className="mt-8 text-sm text-gray-500">OAuth redirect target: {siteUrl}/auth/callback</p>
    </div>
  )
}
