"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { 
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    updateProfile,
    User as FirebaseUser
} from "firebase/auth"
import { auth } from "./firebase"

export interface Profile {
    id: string
    full_name: string | null
    phone: string | null
    avatar_url: string | null
    created_at: string
}

// Extend FirebaseUser with an `id` alias for `uid` to match existing codebase usage
type AuthUser = FirebaseUser & { id: string }

interface AuthContextType {
    user: AuthUser | null
    profile: Profile | null
    loading: boolean
    signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>
    signInWithGoogle: () => Promise<{ error: Error | null }>
    signOut: () => Promise<void>
    updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                const authUser = firebaseUser as AuthUser
                authUser.id = firebaseUser.uid
                setUser(authUser)
                setProfile({
                    id: firebaseUser.uid,
                    full_name: firebaseUser.displayName,
                    phone: null,
                    avatar_url: firebaseUser.photoURL,
                    created_at: firebaseUser.metadata.creationTime || new Date().toISOString()
                })
            } else {
                setUser(null)
                setProfile(null)
            }
            setLoading(false)
        })

        return () => unsubscribe()
    }, [])

    const signUp = async (email: string, password: string, fullName: string) => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password)
            if (userCredential.user) {
                await updateProfile(userCredential.user, { displayName: fullName })
            }
            return { error: null }
        } catch (error: any) {
            return { error: new Error(error.message || "Failed to sign up") }
        }
    }

    const signIn = async (email: string, password: string) => {
        try {
            await signInWithEmailAndPassword(auth, email, password)
            return { error: null }
        } catch (error: any) {
            return { error: new Error(error.message || "Failed to sign in") }
        }
    }

    const signInWithGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider()
            await signInWithPopup(auth, provider)
            return { error: null }
        } catch (error: any) {
            return { error: new Error(error.message || "Failed to sign in with Google") }
        }
    }

    const signOut = async () => {
        try {
            await firebaseSignOut(auth)
            setUser(null)
            setProfile(null)
        } catch (error) {
            console.error("Sign out error", error)
        }
    }

    const updateProfileFn = async (updates: Partial<Profile>) => {
        if (!user) return { error: new Error("Not authenticated") }
        
        try {
            if (updates.full_name && updates.full_name !== user.displayName) {
                await updateProfile(user, { displayName: updates.full_name })
            }
            setProfile(prev => prev ? { ...prev, ...updates } : null)
            return { error: null }
        } catch (error: any) {
            return { error: new Error(error.message || "Failed to update profile") }
        }
    }

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            loading,
            signUp,
            signIn,
            signInWithGoogle,
            signOut,
            updateProfile: updateProfileFn
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider")
    }
    return context
}
