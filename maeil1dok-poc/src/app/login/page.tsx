export default function LoginPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">로그인</h1>
      <div className="space-y-4">
        <button
          type="button"
          className="w-full px-4 py-2 bg-yellow-300 text-black rounded font-semibold disabled:opacity-50"
        >
          Kakao로 로그인
        </button>
        <button
          type="button"
          className="w-full px-4 py-2 bg-white border border-gray-300 text-black rounded font-semibold disabled:opacity-50"
        >
          Google로 로그인
        </button>
        <button
          type="button"
          className="w-full px-4 py-2 bg-black text-white rounded font-semibold disabled:opacity-50"
        >
          Apple로 로그인
        </button>
      </div>
      <p className="mt-8 text-sm text-gray-500">
        (Placeholder - OAuth integration coming soon)
      </p>
    </div>
  )
}
