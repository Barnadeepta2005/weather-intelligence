'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase'
import type { SelectedLocation } from '@/lib/types'

export interface SavedLocationRecord {
  id: string
  name: string
  latitude: number
  longitude: number
  country: string
  countryCode?: string
  admin1?: string
}

export function locationIdFor(latitude: number, longitude: number): string {
  return `loc_${latitude.toFixed(4)}_${longitude.toFixed(4)}`.replace(/[^a-zA-Z0-9_-]/g, '_')
}

export function firestoreError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  if (code === 'permission-denied') return 'Your account does not have access to saved locations.'
  if (code === 'unavailable') return 'Saved locations are temporarily unavailable. Please try again.'
  return 'Saved locations could not be updated. Please try again.'
}

export function useSavedLocations(user: User | null) {
  const [locations, setLocations] = useState<SavedLocationRecord[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [saving, setSaving] = useState<boolean>(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !isFirebaseConfigured) {
      setLocations([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const userLocationsRef = collection(getFirebaseFirestore(), 'users', user.uid, 'savedLocations')
    const unsubscribe = onSnapshot(
      userLocationsRef,
      (snapshot) => {
        const records: SavedLocationRecord[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<SavedLocationRecord, 'id'>),
        }))
        records.sort((a, b) => a.name.localeCompare(b.name))
        setLocations(records)
        setLoading(false)
      },
      (err) => {
        setError(firestoreError(err))
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user])

  const isLocationSaved = useCallback(
    (latitude: number, longitude: number): boolean => {
      const targetId = locationIdFor(latitude, longitude)
      return locations.some((loc) => loc.id === targetId)
    },
    [locations]
  )

  const saveLocation = useCallback(
    async (loc: SelectedLocation) => {
      if (!user || saving || !isFirebaseConfigured) return
      const docId = locationIdFor(loc.latitude, loc.longitude)

      setSaving(true)
      setError(null)

      const payload: Omit<SavedLocationRecord, 'id'> & { createdAt: ReturnType<typeof serverTimestamp> } = {
        name: loc.name,
        latitude: Number(loc.latitude.toFixed(4)),
        longitude: Number(loc.longitude.toFixed(4)),
        country: loc.country,
        createdAt: serverTimestamp(),
      }
      if (loc.countryCode) payload.countryCode = loc.countryCode
      if (loc.admin1) payload.admin1 = loc.admin1

      try {
        await setDoc(doc(getFirebaseFirestore(), 'users', user.uid, 'savedLocations', docId), payload)
      } catch (err) {
        setError(firestoreError(err))
      } finally {
        setSaving(false)
      }
    },
    [user, saving]
  )

  const removeLocation = useCallback(
    async (id: string) => {
      if (!user || removingId || !isFirebaseConfigured) return
      setRemovingId(id)
      setError(null)

      try {
        await deleteDoc(doc(getFirebaseFirestore(), 'users', user.uid, 'savedLocations', id))
      } catch (err) {
        setError(firestoreError(err))
      } finally {
        setRemovingId(null)
      }
    },
    [user, removingId]
  )

  const toggleLocation = useCallback(
    async (loc: SelectedLocation) => {
      const docId = locationIdFor(loc.latitude, loc.longitude)
      const existing = locations.find((l) => l.id === docId)
      if (existing) {
        await removeLocation(docId)
      } else {
        await saveLocation(loc)
      }
    },
    [locations, removeLocation, saveLocation]
  )

  return useMemo(
    () => ({
      locations,
      loading,
      saving,
      removingId,
      error,
      isLocationSaved,
      saveLocation,
      removeLocation,
      toggleLocation,
      clearError: () => setError(null),
    }),
    [locations, loading, saving, removingId, error, isLocationSaved, saveLocation, removeLocation, toggleLocation]
  )
}
