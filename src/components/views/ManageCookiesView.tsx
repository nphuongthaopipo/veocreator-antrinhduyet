import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { UserCookie } from '../../types';
import Spinner from '../common/Spinner';

const ManageCookiesView: React.FC = () => {
    const { cookies, addCookie, updateCookie, deleteCookie, activeCookie, setActiveCookie } = useAppContext();
    const { showToast } = useToast();

    const [name, setName] = useState('');
    const [value, setValue] = useState('');
    const [bearerToken, setBearerToken] = useState('');
    const [editingCookie, setEditingCookie] = useState<UserCookie | null>(null);
    const [isFetching, setIsFetching] = useState(false);

    // Effect này chỉ dùng để lắng nghe các thông báo trạng thái từ backend
    useEffect(() => {
        const unsubscribeStatus = window.electronAPI.onAuthStatusUpdate(({ message }) => {
            if (message.includes('Lỗi')) {
                showToast(message, 'error');
                setIsFetching(false); // Dừng trạng thái loading nếu có lỗi
            } else {
                showToast(message, 'info');
            }
        });
        
        // Dọn dẹp listener khi component unmount
        return () => {
            unsubscribeStatus();
        };
    }, [showToast]);

    // Hàm chung để kích hoạt quá trình lấy/cập nhật cookie tự động
    const handleAutoFetch = (cookieToUpdate: UserCookie | null) => {
        setIsFetching(true);
        // Gửi yêu cầu tới backend, kèm theo ID của cookie cần cập nhật (hoặc null nếu là thêm mới)
        window.electronAPI.getFreshCredentials({ existingCookieId: cookieToUpdate ? cookieToUpdate.id : null });
        
        // Reset trạng thái loading sau một khoảng thời gian để tránh bị kẹt
        const timer = setTimeout(() => {
            setIsFetching(false);
        }, 30000); // Reset sau 30 giây
        
        return () => clearTimeout(timer);
    };

    // Các hàm xử lý form thủ công (vẫn giữ lại để linh hoạt)
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !value.trim()) {
            showToast('Vui lòng nhập Tên và Giá trị Cookie.', 'error');
            return;
        }
        const cookieData = { name, value, bearerToken };
        if (editingCookie) {
            updateCookie(editingCookie.id, cookieData);
            showToast('Đã cập nhật cookie thành công!', 'success');
        } else {
            addCookie({ id: new Date().toISOString(), ...cookieData });
            showToast('Đã thêm cookie thành công!', 'success');
        }
        setEditingCookie(null); // Reset form sau khi submit
        setName('');
        setValue('');
        setBearerToken('');
    };

    const handleEdit = (cookie: UserCookie) => {
        setEditingCookie(cookie);
        setName(cookie.name);
        setValue(cookie.value);
        setBearerToken(cookie.bearerToken || "");
        window.scrollTo(0, 0); // Cuộn lên đầu trang để dễ chỉnh sửa
    };

    const handleCancelEdit = () => {
        setEditingCookie(null);
        setName('');
        setValue('');
        setBearerToken('');
    };

    return (
        <div className="animate-fade-in">
            <h1 className="text-3xl font-bold text-light mb-2">Quản lý Cookie & Token</h1>
            <p className="text-dark-text mb-6">Tự động lấy cookie mới hoặc cập nhật cookie đã có chỉ với một cú nhấp chuột.</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                
                {/* CỘT TRÁI: TỰ ĐỘNG THÊM MỚI */}
                <div className="bg-secondary p-6 rounded-lg shadow-md flex flex-col">
                    <h2 className="text-xl font-bold text-light mb-2">Tự động Thêm Mới</h2>
                    <p className="text-dark-text mb-4 flex-grow">Thêm một tài khoản mới. Ứng dụng sẽ tự động lấy, đặt tên và lưu cookie cho bạn.</p>
                    <button onClick={() => handleAutoFetch(null)} disabled={isFetching} className="w-full flex justify-center items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-400">
                        {isFetching ? <><Spinner /> <span className="ml-2">Đang xử lý...</span></> : 'Bắt đầu lấy tự động'}
                    </button>
                </div>
                
                {/* CỘT PHẢI: FORM THÊM/SỬA THỦ CÔNG */}
                <form onSubmit={handleSubmit} className="bg-secondary p-6 rounded-lg shadow-md space-y-4">
                    <h2 className="text-xl font-bold text-light">{editingCookie ? 'Chỉnh sửa (Thủ công)' : 'Thêm Mới (Thủ công)'}</h2>
                    <div>
                        <label htmlFor="cookie-name" className="block text-dark-text font-bold mb-1 text-sm">Tên gợi nhớ</label>
                        <input
                            id="cookie-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ví dụ: Tài khoản Google chính"
                            className="w-full p-2 bg-primary rounded-md border border-border-color focus:ring-2 focus:ring-accent focus:outline-none transition"
                        />
                    </div>
                    <div>
                        <label htmlFor="cookie-value" className="block text-dark-text font-bold mb-1 text-sm">Giá trị Cookie</label>
                        <textarea
                            id="cookie-value"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder="Dán giá trị cookie tại đây..."
                            className="w-full h-20 p-2 bg-primary rounded-md border border-border-color focus:ring-2 focus:ring-accent focus:outline-none transition font-mono text-xs"
                        />
                    </div>
                    <div>
                        <label htmlFor="bearer-token" className="block text-dark-text font-bold mb-1 text-sm">Bearer Token</label>
                        <input
                            id="bearer-token"
                            type="text"
                            value={bearerToken}
                            onChange={(e) => setBearerToken(e.target.value)}
                            placeholder="Dán giá trị Bearer Token tại đây..."
                            className="w-full p-2 bg-primary rounded-md border border-border-color focus:ring-2 focus:ring-accent focus:outline-none transition font-mono text-xs"
                        />
                    </div>
                    <div className="flex items-center gap-4 pt-2">
                        <button type="submit" className="flex-1 bg-accent hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                            {editingCookie ? 'Lưu Thay đổi' : 'Thêm Mới'}
                        </button>
                        {editingCookie && (
                            <button type="button" onClick={handleCancelEdit} className="flex-1 bg-gray-200 hover:bg-gray-300 text-dark-text font-bold py-2 px-4 rounded-lg transition-colors">
                                Hủy
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* DANH SÁCH ĐÃ LƯU */}
            <div>
                <h2 className="text-2xl font-bold text-light mb-4">Danh sách đã lưu</h2>
                <div className="space-y-4">
                    {cookies.length === 0 ? (
                        <p className="text-dark-text text-center py-8">Chưa có cookie nào được lưu.</p>
                    ) : (
                        cookies.map(cookie => (
                            <div key={cookie.id} className={`p-4 rounded-lg shadow flex flex-col md:flex-row md:items-center justify-between gap-4 ${activeCookie?.id === cookie.id ? 'bg-green-100 border-l-4 border-green-500' : 'bg-secondary'}`}>
                                <div className="flex-1 overflow-hidden">
                                   <h3 className="font-bold text-light">{cookie.name} {activeCookie?.id === cookie.id && <span className="text-green-600 font-normal text-sm">(Đang hoạt động)</span>}</h3>
                                   <p className="text-sm text-gray-500 mt-1 truncate font-mono" title={cookie.value}>Cookie: {cookie.value}</p>
                                </div>
                                 <div className="flex items-center gap-2 flex-shrink-0">
                                    <button onClick={() => setActiveCookie(cookie)} disabled={activeCookie?.id === cookie.id} title="Kích hoạt" className="p-2 rounded-md hover:bg-hover-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                       <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </button>
                                     <button onClick={() => handleAutoFetch(cookie)} disabled={isFetching} title="Đăng nhập lại & Cập nhật" className="p-2 rounded-md hover:bg-blue-100 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
                                    </button>
                                    <button onClick={() => handleEdit(cookie)} title="Sửa thủ công" className="p-2 rounded-md hover:bg-hover-bg transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-dark-text" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    </button>
                                    <button onClick={() => deleteCookie(cookie.id)} title="Xóa" className="p-2 rounded-md hover:bg-red-100 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManageCookiesView;