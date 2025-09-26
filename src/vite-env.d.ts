import { UserCookie } from './types'; 

declare global {
  interface Window {
    electronAPI: {
      // Các hàm API và tự động hóa
      fetch: (url: string, cookie: UserCookie, options: RequestInit) => Promise<any>;
      startBrowserAutomation: (args: { 
        prompts: { id: string; text: string; }[], 
        cookie: UserCookie, 
        model: string, 
        aspectRatio: 'LANDSCAPE' | 'PORTRAIT' 
      }) => void;
      stopBrowserAutomation: () => void;
      onBrowserLog: (callback: (log: {promptId: string, message: string, status?: string, videoUrl?: string}) => void) => () => void;
      
      // Các hàm liên quan đến file
      downloadVideo: (args: { url: string; promptText: string; savePath?: string | null }) => void;
      selectDownloadDirectory: () => Promise<string | null>;
      onDownloadComplete: (callback: (result: {success: boolean, path?: string, error?: string}) => void) => () => void;

      // Các hàm quản lý cookie và xác thực
      getFreshCredentials: (options: { existingCookieId?: string | null }) => void;
      onAuthStatusUpdate: (callback: (status: { message: string }) => void) => () => void;
      onCredentialsReady: (callback: (data: { value: string; bearerToken: string; email: string | null; existingCookieId: string | null }) => void) => () => void;
    };
  }
}

export {};