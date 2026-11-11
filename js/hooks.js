// hooks.js — callback opsional yang dipanggil permainan.
export const hooks = {
  onAnswer: null,     // (missionId, questionId, firstTryCorrect) => void
  onProgress: null,   // () => void : sebuah sabuk selesai atau daftar centang berubah
  onProfile: null,    // () => void : pemain mengganti nama atau karakter
};
