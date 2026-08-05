export {};

declare global {
  interface Window {
    folioDesk?: {
      isDesktop: boolean;
      platform: string;
      openExternal?: (url: string) => Promise<void>;
    };
  }
}
