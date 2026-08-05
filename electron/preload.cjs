/**
 * Folio Desk preload — exposes a tiny, safe bridge for the renderer.
 */
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("folioDesk", {
  isDesktop: true,
  platform: process.platform,
});
