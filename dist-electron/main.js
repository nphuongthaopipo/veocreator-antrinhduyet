"use strict";
const { app, BrowserWindow, screen: electronScreen, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
let stopAutomationFlag = false;
const MAX_CONCURRENT_SESSIONS = 5;
ipcMain.on("auth:get-fresh-credentials", async (event, { existingCookieId = null }) => {
  const mainWindow = BrowserWindow.fromWebContents(event.sender);
  const sendStatus = (message) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("auth:status-update", { message });
    }
  };
  let authBrowser = null;
  try {
    const userDataDir = path.join(app.getPath("userData"), "puppeteer_profile_veo");
    sendStatus("Đang mở trình duyệt...");
    authBrowser = await puppeteer.launch({
      headless: false,
      userDataDir,
      args: ["--window-size=800,600"]
    });
    const page = (await authBrowser.pages())[0];
    await page.goto("https://labs.google/fx/vi/tools/flow", { waitUntil: "networkidle2" });
    if (page.url().includes("accounts.google.com")) {
      sendStatus("Vui lòng đăng nhập vào tài khoản Google...");
      await page.waitForNavigation({ timeout: 3e5, waitUntil: "networkidle2" });
    }
    sendStatus("Đăng nhập thành công, đang lấy thông tin...");
    const credentials = await new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Hết thời gian chờ lấy thông tin xác thực.")), 35e3);
      let credentialFound = false;
      await page.setRequestInterception(true);
      page.on("request", async (request) => {
        if (credentialFound) {
          if (!request.isInterceptResolutionHandled()) request.continue().catch(() => {
          });
          return;
        }
        try {
          const headers = request.headers();
          const authHeader = headers["authorization"];
          const cookieHeader = headers["cookie"];
          if (authHeader && authHeader.startsWith("Bearer ") && cookieHeader && request.url().includes("aisandbox-pa.googleapis.com")) {
            credentialFound = true;
            clearTimeout(timeout);
            const email = await page.evaluate(() => {
              const el = document.querySelector('a[href^="https://accounts.google.com/SignOutOptions"]');
              const ariaLabel = el?.getAttribute("aria-label");
              if (ariaLabel) {
                const match = ariaLabel.match(/\(([^)]+)\)/);
                return match ? match[1] : null;
              }
              return null;
            }).catch(() => null);
            resolve({ value: cookieHeader, bearerToken: authHeader.substring(7), email });
          }
          if (!request.isInterceptResolutionHandled()) request.continue().catch(() => {
          });
        } catch (e) {
        }
      });
      try {
        await page.goto("about:blank", { waitUntil: "networkidle2" });
        await page.goto("https://labs.google/fx/vi/tools/flow", { waitUntil: "networkidle2" });
      } catch (e) {
        reject(new Error("Không thể điều hướng trang để lấy token."));
      }
    });
    mainWindow.webContents.send("auth:credentials-ready", { ...credentials, existingCookieId });
    sendStatus("Lấy thông tin thành công! Tự động đóng trong 2 giây...");
    setTimeout(() => authBrowser.close(), 2e3);
  } catch (error) {
    sendStatus(`Lỗi: ${error.message}`);
    if (authBrowser) await authBrowser.close();
  }
});
async function handleApiRequest(_event, { url, cookie, options }) {
  try {
    const targetUrl = new URL(url);
    let headers = {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      ...options.headers
    };
    if (targetUrl.hostname === "labs.google") {
      headers = { ...headers, "Accept": "*/*", "Cookie": cookie.value, "Origin": "https://labs.google", "Referer": "https://labs.google/", "X-Same-Domain": "1" };
    } else if (targetUrl.hostname === "aisandbox-pa.googleapis.com") {
      if (!cookie.bearerToken) throw new Error("Bearer Token is required.");
      headers = { ...headers, "Accept": "application/json, text/plain, */*", "Authorization": `Bearer ${cookie.bearerToken}`, "Cookie": cookie.value, "Origin": "https://labs.google", "Referer": "https://labs.google/" };
    }
    const body = typeof options.body === "object" ? JSON.stringify(options.body) : options.body;
    const response = await fetch(url, { ...options, headers, body });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error Response:", errorText);
      const err = new Error(`API request to ${url} failed with status ${response.status}`);
      err.status = response.status;
      throw err;
    }
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } catch (error) {
    console.error(`Failed to fetch ${url}`, error);
    throw error;
  }
}
ipcMain.on("browser:stop-automation", () => {
  console.log("Received stop automation signal.");
  stopAutomationFlag = true;
});
ipcMain.on("download-video", async (event, { url, promptText, savePath }) => {
  const mainWindow = BrowserWindow.fromWebContents(event.sender);
  let finalPath = savePath;
  if (!finalPath) {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Lưu video",
      defaultPath: `veo-video-${promptText.replace(/[^a-z0-9]/gi, "_").substring(0, 50)}.mp4`,
      filters: [{ name: "MP4 Videos", extensions: ["mp4"] }]
    });
    if (canceled || !filePath) {
      mainWindow.webContents.send("download-complete", { success: false, error: "Download canceled" });
      return;
    }
    finalPath = filePath;
  } else {
    const safeFilename = promptText.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
    finalPath = path.join(savePath, `${safeFilename}-${Date.now()}.mp4`);
  }
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch video: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(finalPath, buffer);
    mainWindow.webContents.send("download-complete", { success: true, path: finalPath });
  } catch (error) {
    console.error("Download error:", error);
    mainWindow.webContents.send("download-complete", { success: false, error: error.message });
  }
});
ipcMain.handle("select-download-directory", async (event) => {
  const mainWindow = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"]
  });
  if (canceled || filePaths.length === 0) return null;
  return filePaths[0];
});
ipcMain.on("browser:start-automation", async (event, { prompts, cookie: activeCookie, model, aspectRatio }) => {
  const mainWindow = BrowserWindow.fromWebContents(event.sender);
  stopAutomationFlag = false;
  let projectId;
  const sendLog = (promptId, message, status, videoUrl = null) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("browser:log", { promptId, message, status, videoUrl });
    }
    console.log(`[${promptId || "general"}] ${message}`);
  };
  try {
    sendLog(null, "Đang khởi tạo phiên làm việc với cookie đã lưu...", "running");
    try {
      const newProjectResponse = await handleApiRequest(null, {
        url: "https://labs.google/fx/api/trpc/project.createProject",
        cookie: activeCookie,
        options: { method: "POST", body: { json: { projectTitle: `Veo Project Auto - ${(/* @__PURE__ */ new Date()).toLocaleString()}`, toolName: "PINHOLE" } } }
      });
      projectId = newProjectResponse?.result?.data?.json?.result?.projectId;
      if (!projectId) throw new Error("Không thể tạo project mới qua API.");
      sendLog(null, `Đã tạo project mới: ${projectId}`, "running");
    } catch (error) {
      if (error.status === 401) {
        sendLog(null, 'Lỗi: Cookie đã hết hạn hoặc không hợp lệ. Vui lòng vào "Quản lý Cookie" và lấy lại cookie mới.', "error");
        return;
      }
      throw error;
    }
    const promptQueue = [...prompts.map((p) => ({ ...p, status: "queued" }))];
    const processingPrompts = /* @__PURE__ */ new Map();
    const mainLoop = async () => {
      while ((promptQueue.length > 0 || processingPrompts.size > 0) && !stopAutomationFlag) {
        if (processingPrompts.size < MAX_CONCURRENT_SESSIONS && promptQueue.length > 0) {
          const promptToSubmit = promptQueue.shift();
          processingPrompts.set(promptToSubmit.id, { ...promptToSubmit, status: "submitting" });
          (async () => {
            sendLog(promptToSubmit.id, "Đang gửi prompt qua API...", "submitting");
            try {
              const clientGeneratedSceneId = `client-generated-uuid-${Date.now()}-${Math.random()}`;
              const requestBody = {
                "clientContext": { "projectId": projectId, "tool": "PINHOLE" },
                "requests": [{
                  "aspectRatio": `VIDEO_ASPECT_RATIO_${aspectRatio}`,
                  "seed": Math.floor(Math.random() * 1e5),
                  "textInput": { "prompt": promptToSubmit.text },
                  "videoModelKey": model,
                  "metadata": [{ "sceneId": clientGeneratedSceneId }]
                }]
              };
              const response = await handleApiRequest(null, {
                url: "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoText",
                cookie: activeCookie,
                options: { method: "POST", body: requestBody }
              });
              const operation = response?.operations?.[0];
              if (!operation?.operation?.name || !operation?.sceneId) {
                throw new Error("Phản hồi API không hợp lệ khi gửi prompt.");
              }
              processingPrompts.set(promptToSubmit.id, {
                ...promptToSubmit,
                status: "processing",
                operationName: operation.operation.name,
                sceneId: operation.sceneId
              });
              sendLog(promptToSubmit.id, "Đang xử lý...", "processing");
            } catch (error) {
              sendLog(promptToSubmit.id, `Lỗi khi gửi: ${error.message}`, "error");
              processingPrompts.delete(promptToSubmit.id);
            }
          })();
        }
        const promptsToCheck = Array.from(processingPrompts.values()).filter((p) => p.status === "processing");
        if (promptsToCheck.length > 0) {
          try {
            const operationsPayload = promptsToCheck.map((p) => [{ operation: { name: p.operationName }, sceneId: p.sceneId }]);
            const statusResponse = await handleApiRequest(null, {
              url: "https://aisandbox-pa.googleapis.com/v1/video:batchCheckAsyncVideoGenerationStatus",
              cookie: activeCookie,
              options: { method: "POST", body: { operations: operationsPayload } }
            });
            for (const operationResult of statusResponse.operations) {
              const sceneId = operationResult.sceneId;
              const correspondingPrompt = promptsToCheck.find((p) => p.sceneId === sceneId);
              if (!correspondingPrompt) continue;
              const apiStatus = operationResult.status;
              if (apiStatus === "MEDIA_GENERATION_STATUS_SUCCESSFUL") {
                const videoUrl = operationResult?.operation?.metadata?.video?.fifeUrl || operationResult?.operation?.metadata?.video?.servingBaseUri;
                sendLog(correspondingPrompt.id, "Video hoàn thành!", "success", videoUrl);
                processingPrompts.delete(correspondingPrompt.id);
              } else if (apiStatus === "MEDIA_GENERATION_STATUS_FAILED") {
                const errorMsg = operationResult?.error?.message || "Lỗi không xác định";
                sendLog(correspondingPrompt.id, `Tạo video thất bại: ${errorMsg}`, "error");
                processingPrompts.delete(correspondingPrompt.id);
              }
            }
          } catch (error) {
            sendLog(null, `Lỗi khi kiểm tra trạng thái hàng loạt: ${error.message}`, "error");
            if (error.status === 401) {
              stopAutomationFlag = true;
              sendLog(null, "Lỗi 401: Cookie hết hạn giữa chừng. Vui lòng cập nhật và chạy lại.", "error");
            }
            await new Promise((resolve) => setTimeout(resolve, 5e3));
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 3e3));
      }
      if (!stopAutomationFlag) {
        sendLog(null, "Tất cả các prompt đã được xử lý!", "success");
      } else {
        sendLog(null, "Quá trình đã bị dừng.", "error");
      }
    };
    mainLoop();
  } catch (error) {
    sendLog(null, `Lỗi khởi tạo nghiêm trọng: ${error.message}`, "error");
  }
});
function createWindow() {
  const primaryDisplay = electronScreen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const mainWindow = new BrowserWindow({
    width,
    height,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });
  const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}
app.whenReady().then(() => {
  ipcMain.handle("fetch-api", handleApiRequest);
  createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
