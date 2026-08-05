/**
 * Folio Desk preload — exposes a tiny, safe bridge for the renderer.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("folioDesk", {
  isDesktop: true,
  platform: process.platform,
  /** Open URL in the system browser (Dropbox OAuth needs a real browser for Google sign-in). */
  openExternal: (url) => ipcRenderer.invoke("folio:open-external", url),
  /** Right-click on editable prose — spelling + synonyms (renderer draws Folio UI). */
  onEditorContextMenu: (handler) => {
    const listener = (_event, payload) => {
      if (payload && typeof payload === "object") handler(payload);
    };
    ipcRenderer.on("folio:editor-context-menu", listener);
    return () =>
      ipcRenderer.removeListener("folio:editor-context-menu", listener);
  },
  replaceMisspelling: (text) =>
    ipcRenderer.invoke("folio:replace-misspelling", text),
  addToSpellCheckerDictionary: (word) =>
    ipcRenderer.invoke("folio:add-spell-word", word),
  /** @deprecated Prefer onEditorContextMenu — kept for older renderer builds. */
  onThesaurus: (handler) => {
    const listener = (_event, payload) => {
      if (payload && typeof payload.word === "string") handler(payload);
    };
    ipcRenderer.on("folio:thesaurus", listener);
    return () => ipcRenderer.removeListener("folio:thesaurus", listener);
  },
});
