import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"

const firebaseConfig = import.meta.env.FIREBASE_CONFIG;

const app = initializeApp(firebaseConfig);
export default getFirestore();