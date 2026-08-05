/**
 * Folio Desk preload — exposes a tiny, safe bridge for the renderer.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("folioDesk", {
  isDesktop: true,
  platform: process.platform,
  /** Open URL in the system browser (Dropbox OAuth needs a real browser for Google sign-in). */
  openExternal: (url) => ipcRenderer.invoke("folio:open-external", url),
});
