import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyB3JRQKuOF0ruoosB1f5yFMs6sXkPABK88',
  authDomain: 'fayrly-ce8ac.firebaseapp.com',
  projectId: 'fayrly-ce8ac',
  storageBucket: 'fayrly-ce8ac.firebasestorage.app',
  messagingSenderId: '82427319495',
  appId: '1:82427319495:web:007bc4b172ba7dae165ae2',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
