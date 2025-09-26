import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';

type HistoryTab = 'stories' | 'thumbnails' | 'videos' | 'prompts';

// SỬA LỖI: Định nghĩa kiểu cho props của DeleteButton
interface DeleteButtonProps {
    onClick: () => void;
}

const HistoryView: React.FC = () => {
    const { 
        stories, deleteStory,
        prompts, deletePrompt,
        thumbnails, deleteThumbnail,
        videos, deleteVideo 
    } = useAppContext();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<HistoryTab>('stories');

    const handleCopyToClipboard = (content: string, type: string) => {
        navigator.clipboard.writeText(content).then(() => {
            showToast(`Đã sao chép ${type}!`, 'success');
        }, (err) => {
            showToast(`Lỗi khi sao chép: ${err}`, 'error');
        });
    };
    
    // SỬA LỖI: Áp dụng kiểu đã định nghĩa
    const DeleteButton: React.FC<DeleteButtonProps> = ({ onClick }) => (
        <button onClick={onClick} title="Xóa" className="p-2 rounded-md hover:bg-red-100 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
        </button>
    );


    const renderTabContent = () => {
        switch (activeTab) {
            case 'stories':
                return (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {stories.length === 0 ? <p className="text-dark-text col-span-full text-center py-8">Chưa có câu chuyện nào.</p> : (
                            stories.map(story => (
                                <div key={story.id} className="bg-secondary p-4 rounded-lg shadow hover:shadow-xl transition-shadow flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-bold text-light truncate flex-1 pr-2">{story.title}</h3>
                                            <DeleteButton onClick={() => deleteStory(story.id)} />
                                        </div>
                                        <p className="text-gray-500 text-sm mt-2 h-20 overflow-hidden text-ellipsis">{story.content}</p>
                                    </div>
                                    <button onClick={() => handleCopyToClipboard(story.content, 'câu chuyện')} className="mt-4 text-sm bg-primary hover:bg-gray-200 text-dark-text font-semibold py-1.5 px-3 rounded-lg self-start transition-colors">Sao chép nội dung</button>
                                </div>
                            ))
                        )}
                    </div>
                );
            case 'thumbnails':
                return (
                     <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {thumbnails.length === 0 ? <p className="text-dark-text col-span-full text-center py-8">Chưa có thumbnail nào.</p> : (
                            thumbnails.map(thumb => (
                                <div key={thumb.id} className="bg-secondary rounded-lg shadow overflow-hidden group relative">
                                    <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <DeleteButton onClick={() => deleteThumbnail(thumb.id)} />
                                    </div>
                                    <img src={thumb.imageUrl} alt={thumb.storyTitle} className="w-full h-auto object-cover aspect-video" />
                                    <p className="text-xs text-dark-text p-2 truncate">{thumb.storyTitle}</p>
                                </div>
                            ))
                        )}
                    </div>
                );
            case 'videos':
                return (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {videos.length === 0 ? <p className="text-dark-text col-span-full text-center py-8">Chưa có video nào.</p> : (
                            videos.map(video => (
                                <div key={video.id} className="bg-secondary p-4 rounded-lg shadow">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-gray-500 text-sm truncate flex-1 pr-2" title={video.promptText}>{video.promptText}</p>
                                        <DeleteButton onClick={() => deleteVideo(video.id)} />
                                    </div>
                                    {video.status === 'completed' && (video.videoUrl || video.localPath) ? (
                                        <video controls src={video.localPath || video.videoUrl} className="w-full rounded-md bg-black"></video>
                                    ) : (
                                        <div className="w-full aspect-video bg-primary rounded-md flex items-center justify-center">
                                            <p className="text-dark-text">Video đang xử lý...</p>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                );
            case 'prompts':
                 return (
                     <div className="space-y-3">
                        {prompts.length === 0 ? <p className="text-dark-text text-center py-8">Chưa có prompt nào.</p> : (
                            prompts.map(prompt => (
                                <div key={prompt.id} className="bg-secondary p-3 rounded-lg shadow flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-700">{prompt.prompt}</p>
                                        <p className="text-xs text-dark-text mt-1">Từ: {prompt.storyTitle}</p>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button onClick={() => handleCopyToClipboard(prompt.prompt, 'prompt')} className="p-2 rounded-md hover:bg-gray-200 transition-colors" title="Sao chép">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-dark-text" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                        </button>
                                        <DeleteButton onClick={() => deletePrompt(prompt.id)} />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                );
            default:
                return null;
        }
    }

    const tabs: { id: HistoryTab; label: string; count: number }[] = [
        { id: 'stories', label: 'Câu chuyện', count: stories.length },
        { id: 'prompts', label: 'Prompts Video', count: prompts.length },
        { id: 'thumbnails', label: 'Thumbnails', count: thumbnails.length },
        { id: 'videos', label: 'Videos', count: videos.length },
    ];

    return (
        <div className="animate-fade-in">
            <h1 className="text-3xl font-bold text-light mb-2">Lịch sử Tạo</h1>
            <p className="text-dark-text mb-6">Xem lại tất cả nội dung bạn đã tạo.</p>

            <div className="mb-6">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        {tabs.map(tab => (
                             <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors
                                ${activeTab === tab.id
                                    ? 'border-accent text-accent'
                                    : 'border-transparent text-dark-text hover:text-light hover:border-gray-300'
                                }`}
                            >
                                {tab.label} <span className={`ml-1.5 rounded-full py-0.5 px-2 text-xs font-semibold ${activeTab === tab.id ? 'bg-accent/20 text-accent' : 'bg-primary text-dark-text'}`}>{tab.count}</span>
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            <div className="mt-6">
                {renderTabContent()}
            </div>
        </div>
    );
};

export default HistoryView;

