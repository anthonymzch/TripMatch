// Config pública del proyecto Firebase (no es secreta: la clave de API
// web solo identifica el proyecto, la seguridad real la da Firestore
// Rules comprobando el email autenticado).
const firebaseConfig = {
  projectId: "via-a-dos-pwa",
  appId: "1:792471877892:web:2520d5d41fb5a61765f851",
  storageBucket: "via-a-dos-pwa.firebasestorage.app",
  apiKey: "AIzaSyD97ps3RdIjBcyLnN8aCARGqXLi8iFNVzE",
  authDomain: "via-a-dos-pwa.firebaseapp.com",
  messagingSenderId: "792471877892"
};

firebase.initializeApp(firebaseConfig);

const ALLOWED_EMAILS = ['anthony.mendoza300@gmail.com', 'scarlethcc1999@gmail.com'];

const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();
