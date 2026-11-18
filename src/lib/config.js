// Firebase 웹 앱 설정 (Firebase 콘솔 > 프로젝트 설정 > 내 앱).
// 웹용 설정값은 브라우저에 공개되는 값이며, 접근 제한은 Firestore 규칙이 맡는다.
// VITE_LOCAL=1로 빌드하면 '로컬 시연 모드'로 동작한다 (이 브라우저 안에서만 저장, 테스트용).
const FIREBASE = {
  apiKey: 'AIzaSyDL1WqTeGqQFQ234bHoBrnawrkaX6yI3kc',
  authDomain: 'link-mvp-f5275.firebaseapp.com',
  projectId: 'link-mvp-f5275',
  storageBucket: 'link-mvp-f5275.firebasestorage.app',
  messagingSenderId: '987216590005',
  appId: '1:987216590005:web:7f216ae61d558317cf7afc',
};
export const FIREBASE_CONFIG = import.meta.env.VITE_LOCAL ? null : FIREBASE;
