import { app } from './app.svelte.js';

/** 프로젝트 화면으로 이동한다. 로컬 테스트용 as 값은 유지한다. */
export function openProject(code, { local = app.isLocal } = {}) {
  const testUser = new URLSearchParams(location.search).get('as');
  location.search = `?r=${code}${local && app.hasRemote ? '&local=1' : ''}${testUser ? '&as=' + testUser : ''}`;
}
