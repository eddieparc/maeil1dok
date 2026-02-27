import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

function getFirebaseAdmin() {
  if (getApps().length === 0) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    if (!serviceAccountKey) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set')
    }
    const serviceAccount = JSON.parse(serviceAccountKey) as object
    initializeApp({ credential: cert(serviceAccount as Parameters<typeof cert>[0]) })
  }
  return getMessaging()
}

export { getFirebaseAdmin }
