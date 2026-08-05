export {};

declare global {
  interface Window {
    folioDesk?: {
      isDesktop: boolean;
      platform: string;
      openExternal?: (url: string) => Promise<void>;
      onEditorContextMenu?: (
        handler: (payload: {
          x: number;
          y: number;
          selectionText?: string;
          misspelledWord?: string;
          dictionarySuggestions?: string[];
          isEditable?: boolean;
          word?: string;
        }) => void,
      ) => () => void;
      replaceMisspelling?: (text: string) => Promise<boolean>;
      addToSpellCheckerDictionary?: (word: string) => Promise<boolean>;
      /** @deprecated Prefer onEditorContextMenu */
      onThesaurus?: (
        handler: (payload: { word: string; x?: number; y?: number }) => void,
      ) => () => void;
    };
  }
}
