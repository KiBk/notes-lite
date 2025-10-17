import { registerSW } from 'virtual:pwa-register'

const enableSw = () => {
  if (import.meta.env.DEV) {
    return
  }
  if (!('serviceWorker' in navigator)) {
    console.warn('[pwa] Service workers are not supported in this browser')
    return
  }

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      console.info('[pwa] Update available; reloading to apply the latest version')
      updateSW(true).catch((error) => {
        console.error('[pwa] Failed to refresh service worker', error)
      })
    },
    onOfflineReady() {
      console.info('[pwa] App ready to work offline')
    },
    onRegisterError(error) {
      console.error('[pwa] Service worker registration failed', error)
    },
  })
}

enableSw()
