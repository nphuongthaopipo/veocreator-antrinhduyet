"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electronAPI", {
  fetch: (url, cookie, options) => ipcRenderer.invoke("fetch-api", { url, cookie, options }),
  startBrowserAutomation: (args) => ipcRenderer.send("browser:start-automation", args),
  stopBrowserAutomation: () => ipcRenderer.send("browser:stop-automation"),
  downloadVideo: (args) => ipcRenderer.send("download-video", args),
  selectDownloadDirectory: () => ipcRenderer.invoke("select-download-directory"),
  reLoginCookie: (cookie) => ipcRenderer.send("re-login-cookie", cookie),
  onCookieUpdated: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("cookie-updated-data", listener);
    return () => ipcRenderer.removeListener("cookie-updated-data", listener);
  },
  onCookieUpdateStatus: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("cookie-update-status", listener);
    return () => ipcRenderer.removeListener("cookie-update-status", listener);
  },
  getCookieAndToken: () => ipcRenderer.send("get-cookie-and-token"),
  onGetCookieStatus: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("get-cookie-status", listener);
    return () => ipcRenderer.removeListener("get-cookie-status", listener);
  },
  // SỬA LỖI: Thêm hàm này vào
  onAuthCredentialsUpdated: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("auth:credentials-updated", listener);
    return () => ipcRenderer.removeListener("auth:credentials-updated", listener);
  },
  onDownloadComplete: (callback) => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on("download-complete", listener);
    return () => ipcRenderer.removeListener("download-complete", listener);
  },
  onBrowserLog: (callback) => {
    const listener = (_event, log) => callback(log);
    ipcRenderer.on("browser:log", listener);
    return () => ipcRenderer.removeListener("browser:log", listener);
  },
  onCookieUpdate: (callback) => {
    const listener = (_event, cookie) => callback(cookie);
    ipcRenderer.on("browser:cookie-update", listener);
    return () => ipcRenderer.removeListener("browser:cookie-update", listener);
  },
  // Các hàm quản lý cookie và xác thực
  getFreshCredentials: (options) => ipcRenderer.send("auth:get-fresh-credentials", options),
  onAuthStatusUpdate: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("auth:status-update", listener);
    return () => ipcRenderer.removeListener("auth:status-update", listener);
  },
  onCredentialsReady: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("auth:credentials-ready", listener);
    return () => ipcRenderer.removeListener("auth:credentials-ready", listener);
  }
});
