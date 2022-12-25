import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
    apiKey: "AIzaSyCyQ7PJ9WXPBiubfYPT830mnMOP8cICr7s",
    authDomain: "complete-list.firebaseapp.com",
    databaseURL: "https://complete-list-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "complete-list",
    storageBucket: "complete-list.appspot.com",
    messagingSenderId: "217706565968",
    appId: "1:217706565968:web:ba7a15ffb4fa4a5ce3dc55"
};


const app = initializeApp(firebaseConfig);
export default getFirestore();