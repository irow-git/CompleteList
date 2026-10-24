import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"

const rawConfig = import.meta.env.VITE_FIREBASE_CONFIG
const jsonConfig = JSON.parse(rawConfig)

const app = initializeApp(jsonConfig);
export default getFirestore();