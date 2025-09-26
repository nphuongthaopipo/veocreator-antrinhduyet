import React, { useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import Spinner from '../common/Spinner';
import { UserCookie, Story, VideoPrompt, AutomationState, AutomationPrompt, AutomationStatus } from '../../types';
import { useToast } from '../../context/ToastContext';

const AutoBrowserView: React.FC = () => {
    const { 
        cookies, 
        activeCookie, 
        setActiveCookie, 
        stories, 
        prompts: allPrompts, 
        addVideo, // Thêm hàm addVideo từ context
        autoSaveConfig,
        setAutoSaveConfig,
        automationState, 
        setAutomationState 
    } = useAppContext();
    
    const { showToast } = useToast();
    
    const { prompts, isRunning, overallProgress, statusMessage, model, aspectRatio } = automationState;

    const setPrompts = (updater: React.SetStateAction<AutomationPrompt[]>) => {
        setAutomationState((prev: any) => ({ ...prev, prompts: typeof updater === 'function' ? updater(prev.prompts) : updater }));
    };
    
    const setModel = (newModel: string) => {
        setAutomationState((prev: any) => ({ ...prev, model: newModel }));
    };

    const setAspectRatio = (newAspectRatio: 'LANDSCAPE' | 'PORTRAIT') => {
        setAutomationState((prev: any) => ({ ...prev, aspectRatio: newAspectRatio }));
    };
    
    const updatePromptText = (id: string, text: string) => {
        setPrompts((prev: AutomationPrompt[]) => prev.map((p: AutomationPrompt) => p.id === id ? { ...p, text } : p));
    };

    // SỬA LỖI: Khai báo lại hàm handleDownload
    const handleDownload = (videoUrl: string | undefined, promptText: string) => {
        if (videoUrl) {
           window.electronAPI.downloadVideo({ url: videoUrl, promptText });
        } else {
            showToast('Không có URL video để tải xuống.', 'error');
        }
    };

    useEffect(() => {
        const unsubscribeLog = window.electronAPI.onBrowserLog((log) => {
            setAutomationState((prev: AutomationState) => {
                let videoAddedToHistory = false;
                const newPrompts = prev.prompts.map((p: AutomationPrompt) => {
                    if (p.id === log.promptId) {
                        const newStatus = log.status as AutomationStatus || p.status;
                        
                        // CẬP NHẬT: Thêm video vào lịch sử khi hoàn thành
                        if (newStatus === 'success' && log.videoUrl && !p.videoUrl) {
                           addVideo({
                                id: `${p.id}-${Date.now()}`,
                                promptId: p.id,
                                promptText: p.text,
                                status: 'completed',
                                videoUrl: log.videoUrl,
                                operationName: log.operationName || undefined
                           });
                           videoAddedToHistory = true;
                        }

                        if (newStatus === 'success' && log.videoUrl && autoSaveConfig.enabled && autoSaveConfig.path) {
                            window.electronAPI.downloadVideo({ url: log.videoUrl, promptText: p.text, savePath: autoSaveConfig.path });
                        }

                        return { 
                            ...p, 
                            status: newStatus, 
                            message: log.message, 
                            videoUrl: log.videoUrl || p.videoUrl,
                            operationName: log.operationName || p.operationName
                        };
                    }
                    return p;
                });
                
                if(videoAddedToHistory) {
                    showToast('Video mới đã được thêm vào Lịch sử!', 'info');
                }

                const processingCount = newPrompts.filter(p => ['running', 'submitting', 'processing', 'success', 'error'].includes(p.status)).length;
                const newProgress = newPrompts.length > 0 ? (processingCount / newPrompts.length) * 100 : 0;
                
                const allDone = newPrompts.every(p => p.status === 'success' || p.status === 'error');
                const newIsRunning = !allDone && prev.isRunning; 
                
                return {
                    ...prev,
                    prompts: newPrompts,
                    overallProgress: newProgress,
                    statusMessage: newIsRunning ? `Đang xử lý ${processingCount}/${newPrompts.length}...` : "Hoàn thành!",
                    isRunning: newIsRunning
                };
            });
        });
        
        const unsubscribeDownload = window.electronAPI.onDownloadComplete(({success, path, error}) => {
            if (success) {
                showToast(`Video đã được lưu tại: ${path}`, 'success');
            } else {
                showToast(`Lỗi tải video: ${error}`, 'error');
            }
        });

        return () => {
            unsubscribeLog();
            unsubscribeDownload();
        };
    }, [setAutomationState, autoSaveConfig, addVideo, showToast]);

    const handleSelectSaveDir = async () => {
        const path = await window.electronAPI.selectDownloadDirectory();
        if (path) {
            setAutoSaveConfig({ ...autoSaveConfig, path });
            showToast(`Thư mục lưu tự động: ${path}`, 'success');
        }
    };
    
    const handleRunSingle = (promptId: string) => {
        if (!activeCookie) {
            showToast('Vui lòng chọn Cookie.', 'error');
            return;
        }
        const promptToRun = prompts.find(p => p.id === promptId);
        if (promptToRun) {
            setAutomationState(prev => ({
                ...prev,
                isRunning: true,
                prompts: prev.prompts.map(p => p.id === promptId ? { ...p, status: 'queued', message: 'Đang chờ...' } : p)
            }));
            window.electronAPI.startBrowserAutomation({ prompts: [promptToRun], cookie: activeCookie, model, aspectRatio });
        }
    };

    const handleRunAll = () => {
        if (!activeCookie || prompts.length === 0) {
            showToast('Vui lòng chọn Cookie và tải prompts.', 'error');
            return;
        }
        if (autoSaveConfig.enabled && !autoSaveConfig.path) {
            showToast('Vui lòng chọn thư mục để tự động lưu video.', 'error');
            return;
        }
        const promptsToRun = prompts.filter((p: AutomationPrompt) => p.status !== 'success');
        setAutomationState((prev: AutomationState) => ({
            ...prev,
            prompts: prompts.map((p: AutomationPrompt) => ({ ...p, status: 'queued', message: 'Đang chờ...' })),
            isRunning: true,
            overallProgress: 0,
            statusMessage: 'Bắt đầu quá trình...'
        }));
        window.electronAPI.startBrowserAutomation({prompts: promptsToRun, cookie: activeCookie, model, aspectRatio});
    };
    
    const handleStopAll = () => {
        window.electronAPI.stopBrowserAutomation();
        setAutomationState((prev: AutomationState) => ({ ...prev, isRunning: false, statusMessage: "Đã dừng bởi người dùng." }));
    };

    const addPromptField = () => {
        setPrompts((prev: AutomationPrompt[]) => [...prev, { id: `prompt-${Date.now()}`, text: '', status: 'idle', message: 'Sẵn sàng' }]);
    };
    
    const removePrompt = (id: string) => {
        setPrompts((prev: AutomationPrompt[]) => prev.filter((p: AutomationPrompt) => p.id !== id));
    };

    return (
        <div className="animate-fade-in h-full flex flex-col">
            <h1 className="text-3xl font-bold text-light mb-2">Tạo video bằng Veo3</h1>
            <p className="text-dark-text mb-6">Tự động hóa quy trình tạo video hàng loạt.</p>
            
            <div className="bg-secondary p-4 rounded-lg shadow-md mb-4 space-y-4">
                {/* Top Control Bar */}
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-sm font-medium text-dark-text mb-1">Cookie</label>
                        <select value={activeCookie?.id || ''} onChange={(e) => setActiveCookie(cookies.find(c => c.id === e.target.value) || null)} className="w-full p-2 bg-primary rounded-md border border-border-color">
                            <option value="">-- Chọn --</option>
                            {cookies.map((c: UserCookie) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-sm font-medium text-dark-text mb-1">Model</label>
                        <select value={model} onChange={e => setModel(e.target.value)} className="w-full p-2 bg-primary rounded-md border border-border-color">
                            <option value="veo_3_0_t2v_fast_ultra">Veo 3 - Fast</option>
                            <option value="veo_3_0_t2v">Veo 3 - Quality</option>
                            <option value="veo_2_1_fast_d_15_t2v">Veo 2 - Fast</option>
                            <option value="veo_2_0_t2v">Veo 2 - Quality</option>
                        </select>
                    </div>
                     <div className="flex-1 min-w-[150px]">
                       <label className="block text-sm font-medium text-dark-text mb-1">Tỷ lệ</label>
                       <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value as any)} className="w-full p-2 bg-primary rounded-md border border-border-color">
                            <option value="LANDSCAPE">16:9 Ngang</option>
                            <option value="PORTRAIT">9:16 Dọc</option>
                        </select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-medium text-dark-text mb-1">Tải prompt</label>
                        <select onChange={(e) => {
                            const storyId = e.target.value;
                            const relatedPrompts = storyId ? allPrompts.filter(p => p.storyId === storyId) : [];
                            setPrompts(relatedPrompts.map(p => ({ id: p.id, text: p.prompt, status: 'idle', message: 'Sẵn sàng' })));
                        }} className="w-full p-2 bg-primary rounded-md border border-border-color">
                            <option value="">-- Từ câu chuyện --</option>
                            {stories.map((s: Story) => <option key={s.id} value={s.id}>{s.title}</option>)}
                        </select>
                    </div>
                </div>
                {/* Bottom Control Bar */}
                <div className="flex items-center gap-4 flex-wrap pt-4 border-t border-border-color">
                     <label htmlFor="auto-save-toggle" className="flex items-center cursor-pointer">
                        <div className="relative">
                            <input type="checkbox" id="auto-save-toggle" className="sr-only peer" checked={autoSaveConfig.enabled} onChange={() => setAutoSaveConfig({...autoSaveConfig, enabled: !autoSaveConfig.enabled })} />
                            <div className="block bg-gray-600 w-14 h-8 rounded-full peer-checked:bg-green-500 transition"></div>
                            <div className="dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition peer-checked:translate-x-full"></div>
                        </div>
                        <div className="ml-3 text-dark-text font-medium">Tự động lưu</div>
                    </label>
                    {autoSaveConfig.enabled && (
                        <button onClick={handleSelectSaveDir} className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg">
                            {autoSaveConfig.path ? '📁 Đổi thư mục' : '📁 Chọn thư mục'}
                        </button>
                     )}
                     <div className="flex-grow"></div>
                    <button onClick={handleRunAll} disabled={isRunning || !activeCookie || prompts.length === 0} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-400">
                         ▶️ Chạy tất cả
                    </button>
                    {isRunning && (
                        <button onClick={handleStopAll} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">
                            🟥 Dừng tất cả
                        </button>
                    )}
                </div>
            </div>

            {isRunning && (
                <div className="mb-4 bg-secondary p-3 rounded-lg shadow-inner">
                     <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-light">{statusMessage}</span>
                        <span className="text-sm font-semibold text-accent">{Math.round(overallProgress)}%</span>
                    </div>
                    <div className="w-full bg-primary rounded-full h-2">
                        <div className="bg-accent h-2 rounded-full transition-all duration-300" style={{ width: `${overallProgress}%` }}></div>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {prompts.map((prompt: AutomationPrompt, index: number) => (
                    <div key={prompt.id} className="bg-secondary p-3 rounded-lg shadow-md grid grid-cols-12 gap-3 items-stretch">
                        <div className="col-span-7 flex flex-col">
                             <div className="flex justify-between items-center mb-1">
                                <label className="block text-dark-text text-sm font-bold">Prompt #{index + 1}</label>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                        prompt.status === 'success' ? 'bg-green-100 text-green-800' : 
                                        ['running', 'queued', 'downloading', 'submitting'].includes(prompt.status) ? 'bg-blue-100 text-blue-800' :
                                        prompt.status === 'error' ? 'bg-red-100 text-red-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>{prompt.message}</span>
                                     <button onClick={() => handleRunSingle(prompt.id)} disabled={isRunning || prompt.status === 'success'} title="Chạy prompt này" className="p-1 hover:bg-green-100 rounded-full disabled:opacity-50">
                                        <svg className="h-4 w-4 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"></path></svg>
                                     </button>
                                     <button onClick={() => removePrompt(prompt.id)} disabled={isRunning} title="Xóa" className="p-1 hover:bg-red-100 rounded-full disabled:opacity-50">
                                        <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                     </button>
                                </div>
                            </div>
                            <textarea
                                value={prompt.text}
                                onChange={e => updatePromptText(prompt.id, e.target.value)}
                                className="w-full flex-1 p-2 bg-primary rounded-md border border-border-color text-sm resize-none"
                                readOnly={isRunning}
                            />
                        </div>
                        <div className="col-span-5 flex flex-col items-center justify-center bg-primary rounded-md border border-border-color p-2 min-h-[150px]">
                            {prompt.videoUrl ? (
                                <div className="w-full h-full relative group">
                                    <video key={prompt.videoUrl} controls className="w-full h-full object-contain rounded-md">
                                        <source src={prompt.videoUrl} type="video/mp4" />
                                    </video>
                                    <button 
                                        onClick={() => handleDownload(prompt.videoUrl, prompt.text)}
                                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/50 text-white font-bold py-2 px-4 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                    > Tải về </button>
                                </div>
                            ) : ['running', 'queued', 'downloading', 'submitting'].includes(prompt.status) ? (
                                <div className="text-center"> <Spinner className="w-8 h-8 text-blue-500 mx-auto"/> <p className="mt-2 text-dark-text text-sm capitalize">{prompt.status}...</p> </div>
                            ) : (
                                <div className="text-center text-dark-text text-sm"> <p>Kết quả sẽ hiện ở đây</p> </div>
                            )}
                        </div>
                    </div>
                ))}
                 <button onClick={addPromptField} disabled={isRunning} className="mt-4 w-xl bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg border border-blue-300 disabled:opacity-50">
                    + Thêm Prompt mới
                </button>
            </div>
        </div>
    );
};

export default AutoBrowserView;

