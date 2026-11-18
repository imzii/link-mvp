// 데이터 저장소. 프로젝트(방) 하나가 문서 하나다: rooms/{초대코드}
// 두 가지 구현이 같은 모양을 가진다.
//   - Remote: Firebase Firestore (실시간, 여러 기기)
//   - Local : localStorage + BroadcastChannel (한 브라우저 안, 시뮬레이션과 서버 미설정 시)
// update(patch)는 'members.u123.name' 같은 점 경로를 받아 해당 필드만 바꾼다.
// 값이 null이면 그 필드를 지운다.

import { storage, toast } from './util.js';

const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/10.12.5/';

function setByPath(obj, path, value) {
  const keys = path.split('.');
  let node = obj;
  for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
  if (value === null) delete node[keys.at(-1)];
  else node[keys.at(-1)] = value;
}

export const Local = {
  key: code => 'popcorn.room.' + code,
  channel: 'BroadcastChannel' in window ? new BroadcastChannel('popcorn') : null,
  listeners: new Set(),

  async create(code, data) { storage.set(this.key(code), data); this.notify(code); },
  async update(code, patch) {
    const data = storage.get(this.key(code));
    if (!data) throw new Error('프로젝트가 없습니다');
    for (const [path, value] of Object.entries(patch)) setByPath(data, path, value);
    storage.set(this.key(code), data);
    this.notify(code);
  },
  notify(code) {
    this.channel?.postMessage(code);
    this.listeners.forEach(l => l.code === code && l.fire());
  },
  subscribe(code, callback) {
    const listener = { code, fire: () => callback(storage.get(this.key(code))) };
    const onMessage = e => e.data === code && listener.fire();
    const onStorage = e => e.key === this.key(code) && listener.fire();
    this.listeners.add(listener);
    this.channel?.addEventListener('message', onMessage);
    addEventListener('storage', onStorage);
    listener.fire();
    return () => {
      this.listeners.delete(listener);
      this.channel?.removeEventListener('message', onMessage);
      removeEventListener('storage', onStorage);
    };
  },
};

export async function connectFirebase(config) {
  const { initializeApp } = await import(FIREBASE_SDK + 'firebase-app.js');
  const fs = await import(FIREBASE_SDK + 'firebase-firestore.js');
  const db = fs.getFirestore(initializeApp(config));
  const ref = code => fs.doc(db, 'rooms', code);
  return {
    async create(code, data) { await fs.setDoc(ref(code), data); },
    async update(code, patch) {
      const fields = {};
      for (const [path, value] of Object.entries(patch)) fields[path] = value === null ? fs.deleteField() : value;
      await fs.updateDoc(ref(code), fields);
    },
    subscribe(code, callback) {
      return fs.onSnapshot(ref(code),
        snap => callback(snap.exists() ? snap.data() : null),
        err => toast('서버에 연결하지 못했어요: ' + err.code));
    },
  };
}
