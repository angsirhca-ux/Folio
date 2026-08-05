export {};

declare global {
  interface Window {
    folioDesk?: {
      isDesktop: boolean;
      platform: string;
    };
  }
}
