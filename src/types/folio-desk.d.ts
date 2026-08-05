export {};

declare global {
  interface Window {
    folioDesk?: {
      isDesktop: boolean;
      platform: string;
      openExternal?: (url: string) => Promise<void>;
      onThesaurus?: (
        handler: (payload: { word: string; x?: number; y?: number }) => void,
      ) => () => void;
    };
  }
}
