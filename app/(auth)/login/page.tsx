import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">MM</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">MM Engineering</h1>
          <p className="text-gray-500 mt-1">Supplier Database — Internal Portal</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Sign in to your account</h2>
          <LoginForm />
          <p className="text-xs text-gray-400 text-center mt-6">
            Account access is managed by your administrator.
          </p>
        </div>
      </div>
    </div>
  )
}
