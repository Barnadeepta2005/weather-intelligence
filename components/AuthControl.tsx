'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Loader2, LogIn, LogOut, UserRound, X } from 'lucide-react'
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase'

export interface AuthControlProps {
  onUserChange: (user: User | null) => void
  onLoadingChange: (loading: boolean) => void
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  onSignOutReady?: (signOutFn: () => Promise<void>) => void
}

export function friendlyAuthError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  const isRoutine = code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
  if (!isRoutine && process.env.NODE_ENV !== 'production') {
    console.warn('[Firebase Auth Diagnostic]', error)
  }
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'An account already exists for this email address. Switch to sign in.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/user-not-found': 'The email or password is incorrect.',
    'auth/wrong-password': 'The email or password is incorrect.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Please allow popups and try again.',
    'auth/network-request-failed': 'Could not reach the sign-in service. Check your connection and try again.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment before trying again.',
    'auth/operation-not-allowed': 'Email/Password sign-in is not enabled in the Firebase Console.',
    'auth/unauthorized-domain': 'This domain (localhost) is not authorized in Firebase Console.',
    'auth/invalid-api-key': 'Firebase API key is invalid. Check NEXT_PUBLIC_FIREBASE_API_KEY in .env.local.',
    'permission-denied': 'Database access denied. Please verify your Firestore security rules in Firebase Console.',
  }
  return messages[code] || 'Authentication could not be completed. Please try again.'
}

export async function createProfile(user: User) {
  try {
    await setDoc(
      doc(getFirebaseFirestore(), 'users', user.uid),
      {
        displayName: user.displayName || user.email || 'ATMOS WEATHER user',
        email: user.email || '',
        createdAt: serverTimestamp(),
      },
      { merge: true }
    )
  } catch (err) {
    console.warn('[Firebase Auth] Could not initialize user profile document in Firestore:', err)
  }
}

export function AuthControl({
  onUserChange,
  onLoadingChange,
  isOpen: externalOpen,
  onOpenChange,
  onSignOutReady,
}: AuthControlProps) {
  const [user, setUser] = useState<User | null>(null)
  const [restoring, setRestoring] = useState(true)
  const [internalOpen, setInternalOpen] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)

  const isControlled = externalOpen !== undefined
  const open = isControlled ? externalOpen : internalOpen

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (isControlled) {
        onOpenChange?.(nextOpen)
      } else {
        setInternalOpen(nextOpen)
      }
    },
    [isControlled, onOpenChange]
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setError(null)
        setPassword('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, setOpen])

  const handleSignOut = useCallback(async () => {
    if (submitting || !isFirebaseConfigured) return
    setSubmitting(true)
    try {
      await signOut(getFirebaseAuth())
    } catch (err) {
      setError(friendlyAuthError(err))
      setOpen(true)
    } finally {
      setSubmitting(false)
    }
  }, [submitting, setOpen])

  useEffect(() => {
    if (onSignOutReady) {
      onSignOutReady(handleSignOut)
    }
  }, [onSignOutReady, handleSignOut])

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setRestoring(false)
      onLoadingChange(false)
      return
    }

    let active = true
    const auth = getFirebaseAuth()
    void setPersistence(auth, browserLocalPersistence).catch(() => undefined)
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (!active) return
      setUser(nextUser)
      setRestoring(false)
      onUserChange(nextUser)
      onLoadingChange(false)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [onLoadingChange, onUserChange])

  const close = () => {
    if (submitting) return
    setOpen(false)
    setError(null)
    setPassword('')
  }

  const submitEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting || !isFirebaseConfigured) return
    const normalizedEmail = email.trim()
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.')
      return
    }
    if (mode === 'signup' && password.length < 8) {
      setError('Use a password with at least 8 characters.')
      return
    }
    if (mode === 'signin' && password.length === 0) {
      setError('Enter your password.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const auth = getFirebaseAuth()
      if (mode === 'signup') {
        const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password)
        await createProfile(credential.user)
      } else {
        await signInWithEmailAndPassword(auth, normalizedEmail, password)
      }
      setOpen(false)
      setPassword('')
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const submitGoogle = async () => {
    if (submitting || !isFirebaseConfigured) return
    setSubmitting(true)
    setError(null)
    try {
      const credential = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider())
      if (getAdditionalUserInfo(credential)?.isNewUser) {
        await createProfile(credential.user)
      }
      setOpen(false)
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const userLabel = user?.displayName || user?.email || 'ACCOUNT'

  return (
    <>
      <div className="auth-control">
        {restoring ? (
          <span className="auth-restoring">
            <Loader2 size={13} className="animate-spin" /> ACCOUNT
          </span>
        ) : user ? (
          <div className="account-signed-in">
            <span title={user.email || undefined}>{userLabel}</span>
            <button type="button" onClick={handleSignOut} disabled={submitting} aria-label="Sign out">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
              <b>SIGN OUT</b>
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="account-sign-in"
            onClick={() => {
              setOpen(true)
              setError(null)
            }}
            aria-label="Sign in to your account"
          >
            <UserRound size={14} /> SIGN IN
          </button>
        )}
      </div>

      {open && mounted && createPortal(
        <div className="auth-backdrop" role="presentation" onMouseDown={close}>
          <section
            className="auth-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="auth-close" onClick={close} aria-label="Close account dialog">
              <X size={18} />
            </button>
            <p className="eyebrow">ATMOS WEATHER / ACCOUNT</p>
            <h2 id="auth-title">{mode === 'signin' ? 'Welcome back.' : 'Save your places.'}</h2>
            <p className="auth-copy">
              {mode === 'signin'
                ? 'Sign in to access your saved locations.'
                : 'Create an account to keep locations available across devices.'}
            </p>

            {!isFirebaseConfigured ? (
              <div className="auth-error">
                <AlertTriangle size={16} />
                <span>
                  Firebase configuration is missing in <code>.env.local</code>. Add the required public Firebase variables and reload.
                </span>
              </div>
            ) : (
              <>
                <button type="button" className="auth-google" onClick={submitGoogle} disabled={submitting}>
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />} CONTINUE WITH GOOGLE
                </button>
                <div className="auth-divider">
                  <span>OR EMAIL</span>
                </div>
                <form onSubmit={submitEmail} className="auth-form">
                  <label>
                    EMAIL
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={submitting}
                      required
                    />
                  </label>
                  <label>
                    PASSWORD
                    <input
                      type="password"
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      minLength={8}
                      disabled={submitting}
                      required
                    />
                  </label>
                  {mode === 'signup' && <small>At least 8 characters.</small>}
                  {error && (
                    <div className="auth-error">
                      <AlertTriangle size={16} />
                      <span>{error}</span>
                    </div>
                  )}
                  <button type="submit" className="auth-submit" disabled={submitting}>
                    {submitting ? <Loader2 size={15} className="animate-spin" /> : null}
                    {mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                  </button>
                </form>
                <button
                  type="button"
                  className="auth-switch"
                  disabled={submitting}
                  onClick={() => {
                    setMode(mode === 'signin' ? 'signup' : 'signin')
                    setError(null)
                  }}
                >
                  {mode === 'signin' ? 'NEW HERE? CREATE AN ACCOUNT' : 'ALREADY HAVE AN ACCOUNT? SIGN IN'}
                </button>
              </>
            )}
          </section>
        </div>,
        document.body
      )}
    </>
  )
}
