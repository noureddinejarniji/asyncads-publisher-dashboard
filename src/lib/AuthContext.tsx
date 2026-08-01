// React auth state: owns the auth status and the (non-sensitive) publisher
// profile, and runs the bootstrap refresh on app start. The access token itself
// is never held here — it lives only in the in-memory store in lib/auth.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  bootstrapAuth,
  isTwoFactorChallenge,
  login as loginRequest,
  register as registerRequest,
  signOut as signOutRequest,
  setAuthExpiredHandler,
  verifyTwoFactorLogin,
  type Publisher,
  type RegisterPayload,
} from './auth'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'
export type SignInResult =
  | { twoFactorRequired: false }
  | { twoFactorRequired: true; challengeToken: string; method?: 'app' | 'email'; maskedEmail?: string }

type AuthContextValue = {
  status: AuthStatus
  publisher: Publisher | null
  signIn: (email: string, password: string) => Promise<SignInResult>
  register: (payload: RegisterPayload) => Promise<void>
  verifyTwoFactorSignIn: (challengeToken: string, code: string) => Promise<void>
  signOut: () => Promise<void>
  updatePublisher: (patch: Partial<Publisher>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [publisher, setPublisher] = useState<Publisher | null>(null)

  useEffect(() => {
    // A failed refresh-on-401 anywhere flips us to unauthenticated; RequireAuth
    // then redirects. No hard reload, no token left behind.
    setAuthExpiredHandler(() => {
      setPublisher(null)
      setStatus('unauthenticated')
    })

    let active = true
    bootstrapAuth().then((pub) => {
      if (!active) return
      if (pub) {
        setPublisher(pub)
        setStatus('authenticated')
      } else {
        setPublisher(null)
        setStatus('unauthenticated')
      }
    })

    return () => {
      active = false
      setAuthExpiredHandler(null)
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await loginRequest(email, password)
    if (isTwoFactorChallenge(result)) {
      return result
    }
    setPublisher(result)
    setStatus('authenticated')
    return { twoFactorRequired: false as const }
  }, [])

  const register = useCallback(async (payload: RegisterPayload) => {
    const pub = await registerRequest(payload)
    setPublisher(pub)
    setStatus('authenticated')
  }, [])

  const verifyTwoFactorSignIn = useCallback(async (challengeToken: string, code: string) => {
    const pub = await verifyTwoFactorLogin(challengeToken, code)
    setPublisher(pub)
    setStatus('authenticated')
  }, [])

  const signOut = useCallback(async () => {
    await signOutRequest()
    setPublisher(null)
    setStatus('unauthenticated')
  }, [])

  const updatePublisher = useCallback((patch: Partial<Publisher>) => {
    setPublisher((current) => (current ? { ...current, ...patch } : current))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ status, publisher, signIn, register, verifyTwoFactorSignIn, signOut, updatePublisher }),
    [status, publisher, signIn, register, verifyTwoFactorSignIn, signOut, updatePublisher],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
