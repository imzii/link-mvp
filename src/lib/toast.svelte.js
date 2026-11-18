// 화면 아래 잠깐 뜨는 알림
export const toastState = $state({ message: '', visible: false });
let timer;

export function toast(message) {
  toastState.message = message;
  toastState.visible = true;
  clearTimeout(timer);
  timer = setTimeout(() => (toastState.visible = false), 2200);
}
