import { getAnalytics, setConsent } from "firebase/analytics"
import { initializeApp } from "firebase/app"

const firebaseConfig = {
  apiKey: "AIzaSyBFTMWd50KdTF_OHFwdLuHDma9xiyYAGgw",
  authDomain: "obr-extensions.firebaseapp.com",
  projectId: "obr-extensions",
  storageBucket: "obr-extensions.appspot.com",
  messagingSenderId: "1097208999347",
  appId: "1:1097208999347:web:65d875bed730198b196fc6",
  measurementId: "G-2LFV960RD5",
}

setConsent({
  ad_storage: "denied",
  functionality_storage: "denied",
  analytics_storage: "denied",
  security_storage: "denied",
  personalization_storage: "denied",
})

export const app = initializeApp(firebaseConfig)
export const analytics = getAnalytics(app)
