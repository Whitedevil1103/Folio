import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { BookOpen } from 'lucide-react'

export default function Login() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password)
      } else {
        await signUpWithEmail(email, password)
      }
      navigate('/')
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err.message || 'Google sign-in failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center mb-4">
            <BookOpen size={22} className="text-teal-600" strokeWidth={1.75} />
          </div>
          <h1 className="font-display text-3xl text-ink">Folio</h1>
          <p className="text-ink-muted text-sm mt-1">Your library, wherever you are</p>
        </div>

        <div className="flex bg-ink/5 rounded-full p-1 mb-6">
          <button
            onClick={() => setMode('signin')}
            className={`flex-1 text-sm font-medium py-2 rounded-full transition-colors ${
              mode === 'signin' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted'
            }`}
          >
            Sign in
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 text-sm font-medium py-2 rounded-full transition-colors ${
              mode === 'signup' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted'
            }`}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-4 py-3 rounded-lg border border-ink/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="px-4 py-3 rounded-lg border border-ink/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-teal-600 text-white text-sm font-medium py-3 rounded-lg hover:bg-teal-500 transition-colors disabled:opacity-60"
          >
            {loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-ink/10" />
          <span className="text-xs text-ink-muted">or</span>
          <div className="flex-1 h-px bg-ink/10" />
        </div>

        <button
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-2 border border-ink/15 py-3 rounded-lg text-sm font-medium hover:bg-ink/5 transition-colors"
        >
          Continue with Google
        </button>
      </div>
    </div>
  )
}
