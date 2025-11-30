

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Header } from './components/Header';
import { ComicCard } from './components/ComicCard';
import { UploadModal } from './components/UploadModal';
import { AuthModal } from './components/AuthModal';
import { Reader } from './components/Reader';
import { ComicDetail } from './components/ComicDetail';
import { FeaturedSection } from './components/FeaturedSection';
import { UserProfileModal } from './components/UserProfileModal';
import { Comic, Chapter, ViewState, User, Comment, getUserRank } from './types';
import { getLibrary, saveComicToLibrary, deleteComicFromLibrary, exportLibraryAsJSON, importLibraryFromJSON, updateUserInDB, registerUser } from './services/storage';
import JSZip from 'jszip';

interface ResumeData {
  comic: Comic;
  chapter?: Chapter;
}

type SortOption = 'LATEST' | 'VIEWS' | 'AZ';
type SearchScope = 'ALL' | 'TITLE' | 'AUTHOR';

// Helper function to remove Vietnamese accents for search
const removeAccents = (str: string) => {
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase();
};

export default function App() {
  const [view, setView] = useState<ViewState>('GALLERY');
  const [comics, setComics] = useState<Comic[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');
  const [sortOption, setSortOption] = useState<SortOption>('LATEST');
  const [searchScope, setSearchScope] = useState<SearchScope>('ALL');

  const [selectedComic, setSelectedComic] = useState<Comic | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  
  const [showUpload, setShowUpload] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  
  const [uploadTargetComic, setUploadTargetComic] = useState<Comic | null>(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    loadLibrary();
    const storedUser = localStorage.getItem('vinatoon_user');
    if (storedUser) {
        try {
            setUser(JSON.parse(storedUser));
        } catch (e) {
            console.error("Invalid user data");
        }
    }

    // Scroll listener for Back to Top button
    const handleScroll = () => {
        if (window.scrollY > 300) {
            setShowScrollTop(true);
        } else {
            setShowScrollTop(false);
        }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (comics.length > 0 && !selectedComic) {
        try {
            const lastSession = localStorage.getItem('vinatoon_last_session');
            if (lastSession) {
                const parsed = JSON.parse(lastSession);
                const foundComic = comics.find(c => c.id === parsed.comicId);
                
                if (foundComic) {
                    let foundChapter = undefined;
                    if (parsed.chapterId) {
                        foundChapter = foundComic.chapters.find(ch => ch.id === parsed.chapterId);
                    }
                    setResumeData({ comic: foundComic, chapter: foundChapter });
                }
            }
        } catch (e) {
            console.error("Error parsing last session", e);
        }
    }
  }, [comics, selectedComic]);

  useEffect(() => {
    if (selectedComic) {
        const session = {
            comicId: selectedComic.id,
            chapterId: selectedChapter?.id
        };
        localStorage.setItem('vinatoon_last_session', JSON.stringify(session));
        
        if (resumeData && resumeData.comic.id === selectedComic.id) {
             setResumeData(null);
        }
    }
  }, [selectedComic, selectedChapter, resumeData]);


  const loadLibrary = async () => {
      setLoading(true);
      const loadedComics = await getLibrary();
      setComics(loadedComics);
      setLoading(false);
  };

  const showNotification = (msg: string) => {
      setNotification(msg);
      setTimeout(() => setNotification(null), 3000);
  };

  const scrollToTop = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('vinatoon_user', JSON.stringify(loggedInUser));
    showNotification(`Xin chào, ${loggedInUser.username}!`);
  };

  const handleUpdateUser = async (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('vinatoon_user', JSON.stringify(updatedUser));
    await updateUserInDB(updatedUser);
    showNotification("Đã cập nhật hồ sơ!");
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('vinatoon_user');
    setSelectedCategory('Tất cả'); 
    showNotification("Đã đăng xuất.");
  };

  const handleToggleFollow = (comicId: string) => {
      if (!user) {
          showNotification("Vui lòng đăng nhập để theo dõi truyện.");
          return;
      }

      const currentFollows = user.followedComics || [];
      const isFollowing = currentFollows.includes(comicId);
      
      let newFollows;
      if (isFollowing) {
          newFollows = currentFollows.filter(id => id !== comicId);
          showNotification("Đã bỏ theo dõi.");
      } else {
          newFollows = [...currentFollows, comicId];
          showNotification("Đã thêm vào danh sách theo dõi!");
      }

      const updatedUser = { ...user, followedComics: newFollows };
      handleUpdateUser(updatedUser);
  };

  const categories = useMemo(() => {
    const allTags = new Set<string>();
    comics.forEach(comic => {
      comic.tags.forEach(tag => allTags.add(tag));
    });
    const sortedTags = Array.from(allTags).sort();
    
    const result = ['Tất cả', ...sortedTags];
    
    if (user) {
        result.unshift('Đang theo dõi');
        if (comics.some(c => !!c.lastRead)) {
            result.unshift('Lịch sử');
        }
    }
    
    return result;
  }, [comics, user]);

  const filteredComics = comics.filter(comic => {
      const normalizedQuery = removeAccents(searchQuery);
      let matchesSearch = false;
      
      if (!normalizedQuery) {
          matchesSearch = true;
      } else if (searchScope === 'AUTHOR') {
          matchesSearch = removeAccents(comic.author).includes(normalizedQuery);
      } else if (searchScope === 'TITLE') {
          matchesSearch = removeAccents(comic.title).includes(normalizedQuery);
      } else {
          matchesSearch = (
              removeAccents(comic.title).includes(normalizedQuery) ||
              removeAccents(comic.author).includes(normalizedQuery) ||
              comic.tags.some(tag => removeAccents(tag).includes(normalizedQuery))
          );
      }
      
      let matchesCategory = true;
      if (selectedCategory === 'Tất cả') {
          matchesCategory = true;
      } else if (selectedCategory === 'Đang theo dõi') {
          matchesCategory = user?.followedComics?.includes(comic.id) || false;
      } else if (selectedCategory === 'Lịch sử') {
          matchesCategory = !!comic.lastRead;
      } else {
          matchesCategory = comic.tags.includes(selectedCategory);
      }

      return matchesSearch && matchesCategory;
  }).sort((a, b) => {
      if (selectedCategory === 'Lịch sử') {
          return (b.lastRead?.timestamp || 0) - (a.lastRead?.timestamp || 0);
      }
      if (sortOption === 'VIEWS') {
          return (b.viewCount || 0) - (a.viewCount || 0);
      }
      if (sortOption === 'AZ') {
          return a.title.localeCompare(b.title);
      }
      return b.updatedAt - a.updatedAt;
  });

  const handleSaveComic = async (savedComic: Comic) => {
    try {
        const success = await saveComicToLibrary(savedComic);
        if (success) {
            const refreshedComics = await getLibrary();
            setComics(refreshedComics);

            if (selectedComic && selectedComic.id === savedComic.id) {
                const refreshedComic = refreshedComics.find(c => c.id === savedComic.id);
                if (refreshedComic) {
                    setSelectedComic(refreshedComic);
                }
            }
            showNotification("Đã lưu dữ liệu vào hệ thống!");
        } else {
            showNotification("CẢNH BÁO: Không thể lưu truyện.");
        }
    } catch (e) {
        console.error(e);
        showNotification("Lỗi hệ thống khi lưu truyện.");
    }
  };

  const handleDeleteComic = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Security check: Only ADMIN can delete
    if (user?.role !== 'ADMIN') {
        showNotification("Bạn không có quyền xóa truyện!");
        return;
    }

    if (confirm("Bạn có chắc chắn muốn xóa toàn bộ bộ truyện này không?")) {
        const updatedLibrary = await deleteComicFromLibrary(id);
        setComics(updatedLibrary);
        if (selectedComic && selectedComic.id === id) {
            setView('GALLERY');
            setSelectedComic(null);
        }
        if (resumeData?.comic.id === id) {
            setResumeData(null);
            localStorage.removeItem('vinatoon_last_session');
        }
        showNotification("Đã xóa truyện.");
    }
  };

  const handleExportData = async () => {
    const jsonStr = await exportLibraryAsJSON();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `VinaToon_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification("Đã tải file backup về máy.");
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const content = ev.target?.result as string;
        const success = await importLibraryFromJSON(content);
        if (success) {
            await loadLibrary();
            showNotification("Khôi phục dữ liệu thành công!");
        } else {
            showNotification("Lỗi: File backup không hợp lệ.");
        }
        setLoading(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadSource = async () => {
      showNotification("Đang chuẩn bị gói mã nguồn...");
      const zip = new JSZip();

      const indexPhpContent = `<?php
$request = $_SERVER['REQUEST_URI'];
$request = strtok($request, '?');

if ($request !== '/' && file_exists(__DIR__ . $request)) {
    return false;
}

include __DIR__ . '/index.html';
?>`;
      zip.file("index.php", indexPhpContent);

      const htaccessContent = `RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.php [QSA,L]`;
      zip.file(".htaccess", htaccessContent);

      const readmeContent = `HƯỚNG DẪN CÀI ĐẶT TRÊN HOSTING PHP (CPanel/WordPress Host):

1. Giải nén file zip này ra.
2. Upload toàn bộ file trong thư mục này lên thư mục 'public_html' hoặc thư mục web của bạn.
3. Truy cập website của bạn.`;
      zip.file("README.txt", readmeContent);

      const filesToFetch = [
          'index.html',
          'types.ts',
          'App.tsx',
          'metadata.json',
          'services/storage.ts',
          'services/geminiService.ts',
          'components/Header.tsx',
          'components/ComicCard.tsx',
          'components/UploadModal.tsx',
          'components/Reader.tsx',
          'components/ComicDetail.tsx',
          'components/FeaturedSection.tsx',
          'components/CommentSection.tsx',
          'components/AuthModal.tsx',
          'components/UserProfileModal.tsx'
      ];

      for (const filePath of filesToFetch) {
          try {
              const response = await fetch(`./${filePath}`);
              if (response.ok) {
                  const content = await response.text();
                  zip.file(filePath, content);
              }
          } catch (e) {
              console.warn(`Error fetching ${filePath}`, e);
          }
      }

      try {
          const content = await zip.generateAsync({ type: "blob" });
          const url = URL.createObjectURL(content);
          const a = document.createElement("a");
          a.href = url;
          a.download = "BlogTruyenTranh_Source_PHP.zip";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showNotification("Đã tải gói mã nguồn thành công!");
      } catch (e) {
          console.error("Zip failed", e);
          showNotification("Lỗi khi nén file.");
      }
  };

  const handleOpenComic = (comic: Comic) => {
    const updatedComic = { ...comic, viewCount: (comic.viewCount || 0) + 1 };
    saveComicToLibrary(updatedComic).catch(err => console.error("Failed to update view count", err));
    setComics(prev => prev.map(c => c.id === updatedComic.id ? updatedComic : c));
    setSelectedComic(updatedComic);
    setView('DETAIL');
  };

  const handleReadChapter = (chapter: Chapter) => {
      if (!selectedComic) return;

      const updatedChapters = selectedComic.chapters.map(ch => 
          ch.id === chapter.id 
            ? { ...ch, viewCount: (ch.viewCount || 0) + 1 } 
            : ch
      );

      const updatedComic = { 
          ...selectedComic, 
          chapters: updatedChapters,
          lastRead: {
              chapterId: chapter.id,
              chapterTitle: chapter.title,
              pageIndex: 0,
              timestamp: Date.now()
          }
      };

      saveComicToLibrary(updatedComic).catch(err => console.error("Failed to update chapter view count", err));

      setComics(prev => prev.map(c => c.id === updatedComic.id ? updatedComic : c));
      setSelectedComic(updatedComic);
      
      const updatedChapter = updatedChapters.find(c => c.id === chapter.id) || chapter;
      setSelectedChapter(updatedChapter);

      if (user) {
          const expGain = 10;
          const updatedUser = { 
              ...user, 
              exp: (user.exp || 0) + expGain 
          };
          setUser(updatedUser);
          localStorage.setItem('vinatoon_user', JSON.stringify(updatedUser));
          updateUserInDB(updatedUser).catch(e => console.error("Auto-save user failed", e));
      }

      setView('READER');
  };

  const handleAddChapterClick = () => {
      setUploadTargetComic(selectedComic);
      setShowUpload(true);
  }

  const handleUploadClick = () => {
      setUploadTargetComic(null);
      setShowUpload(true);
  }

  const handleResumeSession = () => {
      if (!resumeData) return;
      
      const updatedComic = { ...resumeData.comic, viewCount: (resumeData.comic.viewCount || 0) + 1 };
      saveComicToLibrary(updatedComic);
      setComics(prev => prev.map(c => c.id === updatedComic.id ? updatedComic : c));
      setSelectedComic(updatedComic);

      if (resumeData.chapter) {
           const updatedChapters = updatedComic.chapters.map(ch => 
                ch.id === resumeData.chapter!.id
                    ? { ...ch, viewCount: (ch.viewCount || 0) + 1 } 
                    : ch
            );
          const finalComic = { ...updatedComic, chapters: updatedChapters };
          saveComicToLibrary(finalComic);
          setComics(prev => prev.map(c => c.id === finalComic.id ? finalComic : c));
          setSelectedComic(finalComic);

          const targetChapter = updatedChapters.find(c => c.id === resumeData.chapter!.id) || resumeData.chapter;
          setSelectedChapter(targetChapter);
          
          if (user) {
              const updatedUser = { ...user, exp: (user.exp || 0) + 10 };
              setUser(updatedUser);
              localStorage.setItem('vinatoon_user', JSON.stringify(updatedUser));
              updateUserInDB(updatedUser).catch(e => console.error("Auto-save user failed", e));
          }

          setView('READER');
      } else {
          setView('DETAIL');
      }
      setResumeData(null);
  }

  const handleDismissResume = () => {
      setResumeData(null);
      localStorage.removeItem('vinatoon_last_session');
  }

  const handleTagClick = (tag: string) => {
    setSelectedCategory(tag);
    setSearchQuery('');
    setView('GALLERY');
    setSelectedComic(null);
  };

  const goBack = () => {
      if (view === 'READER') {
          setView('DETAIL');
          setSelectedChapter(null);
      } else {
          setView('GALLERY');
          setSelectedComic(null);
          setSearchQuery('');
          setSelectedCategory('Tất cả');
      }
  };

  const addReplyRecursively = (comments: Comment[], parentId: string, newReply: Comment): boolean => {
      for (const comment of comments) {
          if (comment.id === parentId) {
              if (!comment.replies) comment.replies = [];
              comment.replies.push(newReply);
              return true;
          }
          if (comment.replies && comment.replies.length > 0) {
              if (addReplyRecursively(comment.replies, parentId, newReply)) {
                  return true;
              }
          }
      }
      return false;
  };

  // Helper recursive function to toggle like
  const toggleLikeInComments = (comments: Comment[], commentId: string, userId: string): Comment[] => {
      return comments.map(c => {
          if (c.id === commentId) {
              const currentLikes = c.likes || [];
              const isLiked = currentLikes.includes(userId);
              const newLikes = isLiked 
                  ? currentLikes.filter(id => id !== userId) 
                  : [...currentLikes, userId];
              return { ...c, likes: newLikes };
          }
          if (c.replies && c.replies.length > 0) {
              return { ...c, replies: toggleLikeInComments(c.replies, commentId, userId) };
          }
          return c;
      });
  };

  const handleAddChapterComment = (content: string, parentId?: string) => {
      if (!selectedComic || !selectedChapter || !user) return;

      const newComment: Comment = {
          id: Date.now().toString(),
          userId: user.id,
          username: user.username,
          userAvatar: user.avatar || '',
          userTitle: getUserRank(user.exp || 0, user.rankSystem || 'NONE'), 
          userRankSystem: user.rankSystem || 'NONE',
          content: content,
          likes: [],
          createdAt: Date.now(),
          replies: []
      };

      let updatedComments = [...(selectedChapter.comments || [])];

      if (parentId) {
          addReplyRecursively(updatedComments, parentId, newComment);
      } else {
          updatedComments.push(newComment);
      }

      const updatedChapter = { ...selectedChapter, comments: updatedComments };
      const updatedChapters = selectedComic.chapters.map(ch => 
          ch.id === updatedChapter.id ? updatedChapter : ch
      );
      const updatedComic = { ...selectedComic, chapters: updatedChapters };

      setSelectedChapter(updatedChapter);
      handleSaveComic(updatedComic);
  };

  // Hack: Attach handleLike logic to the function passed to Reader
  (handleAddChapterComment as any).handleLike = (commentId: string) => {
      if (!selectedComic || !selectedChapter || !user) return;
      
      const updatedComments = toggleLikeInComments(selectedChapter.comments || [], commentId, user.id);
      const updatedChapter = { ...selectedChapter, comments: updatedComments };
      const updatedChapters = selectedComic.chapters.map(ch => 
          ch.id === updatedChapter.id ? updatedChapter : ch
      );
      const updatedComic = { ...selectedComic, chapters: updatedChapters };

      setSelectedChapter(updatedChapter);
      handleSaveComic(updatedComic);
  };

  if (loading) {
      return (
        <div className="min-h-screen bg-brand-900 flex flex-col items-center justify-center text-white gap-4">
             <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
             <p className="text-gray-400 text-sm">Đang tải thư viện...</p>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-brand-900 text-white font-sans selection:bg-brand-accent selection:text-white relative">
      <Header 
        onUploadClick={handleUploadClick} 
        onHomeClick={() => { setView('GALLERY'); setSelectedComic(null); setSelectedChapter(null); setSearchQuery(''); setSelectedCategory('Tất cả'); setSearchScope('ALL'); }}
        onSearch={setSearchQuery}
        onExport={handleExportData}
        onImport={handleImportData}
        currentView={view}
        user={user}
        onLoginClick={() => setShowAuth(true)}
        onLogoutClick={handleLogout}
        onOpenProfile={() => setShowProfile(true)}
        searchScope={searchScope}
        onSearchScopeChange={setSearchScope}
        onCategorySelect={(cat) => {
            setSelectedCategory(cat);
            setSearchQuery('');
            setView('GALLERY');
            setSelectedComic(null);
        }}
        onDownloadSource={handleDownloadSource}
      />

      <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] transition-all duration-500 ${notification ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
          <div className="bg-green-600 text-white px-6 py-2 rounded-full shadow-lg font-medium flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {notification}
          </div>
      </div>

      <main className="pt-20 px-4 md:px-8 pb-10">
        <Suspense fallback={<div className="text-center py-10 text-gray-500">Đang tải nội dung...</div>}>
          {view === 'GALLERY' && (
            <div className="max-w-7xl mx-auto animate-fade-in">
              {resumeData && !searchQuery && (
                  <div className="mb-8 bg-gradient-to-r from-brand-800 to-brand-900 border border-brand-700 rounded-2xl p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={handleDismissResume} className="text-gray-500 hover:text-white bg-black/20 rounded-full p-1">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                          </button>
                      </div>
                      <div className="flex items-center gap-4 w-full md:w-auto">
                          <img src={resumeData.comic.coverImage} alt="Cover" className="w-16 h-24 object-cover rounded-lg shadow-md border border-brand-700 hidden sm:block" />
                          <div>
                              <p className="text-brand-accent text-xs font-bold uppercase tracking-wider mb-1">Đọc tiếp</p>
                              <h3 className="text-white font-bold text-lg md:text-xl line-clamp-1">{resumeData.comic.title}</h3>
                              <p className="text-gray-400 text-sm">
                                  {resumeData.chapter ? resumeData.chapter.title : 'Đang xem thông tin truyện'}
                              </p>
                          </div>
                      </div>
                      <button 
                          onClick={handleResumeSession}
                          className="w-full md:w-auto whitespace-nowrap bg-white text-brand-900 px-6 py-2.5 rounded-full font-bold hover:bg-gray-200 transition-colors shadow-lg flex items-center justify-center gap-2"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                          </svg>
                          Đọc Ngay
                      </button>
                  </div>
              )}

              {/* Show Featured Section regardless of empty check if filters are default */}
              {!searchQuery && selectedCategory === 'Tất cả' && (
                  <FeaturedSection comics={comics} onOpenComic={handleOpenComic} />
              )}

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-4">
                  <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-brand-accent">
                      {searchQuery 
                          ? `Kết quả tìm kiếm: "${searchQuery}"` 
                          : (selectedCategory === 'Tất cả' 
                              ? 'Mới Cập Nhật' 
                              : (selectedCategory === 'Đang theo dõi' 
                                  ? 'Truyện Đang Theo Dõi' 
                                  : (selectedCategory === 'Lịch sử' ? 'Lịch Sử Đọc Truyện' : `Thể loại: ${selectedCategory}`)))}
                  </h2>
                  
                  <div className="flex items-center gap-3">
                      <div className="relative">
                          <select
                              value={sortOption}
                              onChange={(e) => setSortOption(e.target.value as SortOption)}
                              className="appearance-none bg-brand-800 border border-brand-700 text-white text-xs md:text-sm rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent cursor-pointer hover:border-brand-600 transition-colors"
                          >
                              <option value="LATEST">Mới cập nhật</option>
                              <option value="VIEWS">Xem nhiều nhất</option>
                              <option value="AZ">Tên A-Z</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                          </div>
                      </div>
                      <div className="h-4 w-px bg-brand-700"></div>
                      <span className="text-sm text-gray-500">{filteredComics.length} truyện</span>
                  </div>
              </div>

              <div className="flex overflow-x-auto gap-2 mb-8 pb-2 no-scrollbar mask-gradient-right">
                  {categories.map(cat => (
                      <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5
                              ${selectedCategory === cat 
                                  ? (cat === 'Đang theo dõi' 
                                      ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/25' 
                                      : (cat === 'Lịch sử' 
                                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                                          : 'bg-brand-accent text-white shadow-lg shadow-indigo-500/25')
                                    )
                                  : 'bg-brand-800 text-gray-400 hover:bg-brand-700 hover:text-white border border-brand-700'
                              }
                          `}
                      >
                          {cat === 'Đang theo dõi' && (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                              </svg>
                          )}
                          {cat === 'Lịch sử' && (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                              </svg>
                          )}
                          {cat}
                      </button>
                  ))}
              </div>
              
              {filteredComics.length === 0 ? (
                  <div className="text-center py-20 bg-brand-800/30 rounded-2xl border border-dashed border-brand-700">
                      <p className="text-gray-400 text-lg">
                        {comics.length === 0
                            ? 'Thư viện chưa có truyện nào.'
                            : (selectedCategory === 'Đang theo dõi' 
                                ? 'Bạn chưa theo dõi truyện nào.' 
                                : (selectedCategory === 'Lịch sử' 
                                    ? 'Bạn chưa đọc truyện nào.'
                                    : 'Không tìm thấy truyện nào phù hợp.'))
                        }
                      </p>
                      {comics.length > 0 && (
                          <button onClick={() => { setSearchQuery(''); setSelectedCategory('Tất cả'); }} className="mt-4 text-brand-accent hover:underline">
                              Xem tất cả truyện
                          </button>
                      )}
                  </div>
              ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                      {filteredComics.map(comic => (
                      <ComicCard 
                          key={comic.id} 
                          comic={comic} 
                          onClick={handleOpenComic} 
                          onDelete={handleDeleteComic}
                          user={user}
                      />
                      ))}
                  </div>
              )}
            </div>
          )}

          {view === 'DETAIL' && selectedComic && (
              <ComicDetail 
                  comic={selectedComic}
                  onBack={goBack}
                  onReadChapter={handleReadChapter}
                  onAddChapter={handleAddChapterClick}
                  onUpdateStatus={handleSaveComic}
                  user={user}
                  onTagClick={handleTagClick}
                  onToggleFollow={handleToggleFollow}
              />
          )}

          {view === 'READER' && selectedComic && selectedChapter && (
            <Reader 
              comic={selectedComic} 
              chapter={selectedChapter} 
              user={user}
              onAddComment={handleAddChapterComment}
              onNavigateChapter={handleReadChapter}
            />
          )}
        </Suspense>
      </main>

      {/* Scroll To Top Button */}
      <button 
        onClick={scrollToTop}
        className={`fixed bottom-6 right-6 z-40 p-3 rounded-full bg-brand-accent text-white shadow-lg hover:bg-brand-hover transition-all duration-300 transform ${
            showScrollTop ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
        }`}
        aria-label="Lên đầu trang"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </button>

      {showUpload && (
        <UploadModal 
          onClose={() => setShowUpload(false)} 
          onSave={handleSaveComic} 
          existingComic={uploadTargetComic}
        />
      )}

      {showAuth && (
          <AuthModal 
            onClose={() => setShowAuth(false)}
            onLogin={handleLogin}
          />
      )}

      {showProfile && user && (
          <UserProfileModal 
            user={user}
            onClose={() => setShowProfile(false)}
            onUpdateUser={handleUpdateUser}
            onLogout={handleLogout}
          />
      )}
    </div>
  );
}