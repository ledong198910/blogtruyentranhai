

export interface Chapter {
  id: string;
  title: string;
  pages: string[]; // Array of Base64 strings
  comments: Comment[]; // New field for chapter-specific comments
  viewCount?: number; // Added view count
  createdAt: number;
}

export interface Comment {
  id: string;
  userId: string;
  username: string;
  userAvatar: string;
  userTitle?: string; // New field for Rank Title
  userRankSystem?: RankSystem; // New field for specific styling
  content: string;
  replies?: Comment[]; // Nested replies
  likes?: string[]; // Array of User IDs who liked this comment
  createdAt: number;
}

export interface Rating {
  userId: string;
  score: number; // 1 to 5
}

export interface Comic {
  id: string;
  title: string;
  author: string;
  description: string;
  tags: string[];
  coverImage: string; // Base64
  chapters: Chapter[];
  comments: Comment[]; // Comic-level comments
  ratings: Rating[]; // List of user ratings
  status: 'ONGOING' | 'COMPLETED';
  viewCount?: number; // Added view count
  lastRead?: ReadingProgress;
  createdAt: number;
  updatedAt: number;
}

export interface ReadingProgress {
  chapterId: string;
  chapterTitle: string;
  pageIndex: number;
  timestamp: number;
}

export type RankSystem = 'NONE' | 'CULTIVATION' | 'GALAXY' | 'GAME' | 'DEMON' | 'MAGE';

export interface User {
  id: string;
  username: string;
  password?: string; // Added password for DB storage
  email: string;
  avatar?: string;
  role: 'ADMIN' | 'USER';
  exp?: number;
  rankSystem?: RankSystem;
  followedComics?: string[]; // List of comic IDs being followed
}

export type ViewState = 'GALLERY' | 'DETAIL' | 'READER';

// --- GENRES CONSTANTS ---
export const COMIC_GENRES = [
    'Hành Động', 'Phiêu Lưu', 'Hài Hước', 'Kịch Tính', 'Giả Tưởng', 
    'Hậu Cung', 'Lịch Sử', 'Kinh Dị', 'Võ Thuật', 'Cơ Khí', 
    'Bí Ẩn', 'Tâm Lý', 'Tình Cảm', 'Học Đường', 'Khoa Học', 
    'Thiếu Nữ', 'Thiếu Niên', 'Đời Thường', 'Thể Thao', 'Siêu Nhiên', 
    'Bi Kịch', 'Cổ Trang', 'Tiên Hiệp', 'Kiếm Hiệp', 'Ngôn Tình', 
    'Tu Tiên', 'Xuyên Không', 'Trùng Sinh', 'Hệ Thống', 'Đam Mỹ', 'Bách Hợp',
    'Huyền Huyễn', 'Dị Giới', 'Thám Hiểm', 'Quân Sự', 'Thực Tế Ảo'
];

// --- RANKING LOGIC HELPERS ---

export const RANK_TITLES: Record<RankSystem, string[]> = {
    NONE: [],
    CULTIVATION: ['Phàm Nhân', 'Luyện Khí', 'Trúc Cơ', 'Kim Đan', 'Nguyên Anh', 'Hóa Thần', 'Luyện Hư', 'Hợp Thể', 'Đại Thừa', 'Độ Kiếp'],
    GALAXY: ['Người Thường', 'Học Đồ', 'Hành Tinh', 'Hằng Tinh', 'Vũ Trụ', 'Vực Chủ', 'Giới Chủ', 'Bất Hủ', 'Tôn Giả', 'Chi Chủ'],
    GAME: ['Tập Sự', 'Đồng', 'Bạc', 'Vàng', 'Bạch Kim', 'Kim Cương', 'Tinh Anh', 'Cao Thủ', 'Thách Đấu', 'Huyền Thoại'],
    DEMON: ['Linh Hồn', 'Tiểu Quỷ', 'Ác Quỷ', 'Quỷ Tướng', 'Quỷ Soái', 'Quỷ Vương', 'Đại Quỷ Vương', 'Ma Thần', 'Chúa Tể', 'Hư Vô'],
    MAGE: ['Người Thường', 'Học Việc', 'Pháp Sư', 'Đại Pháp Sư', 'Ma Đạo Sư', 'Đại Ma Đạo Sư', 'Thánh Pháp Sư', 'Pháp Thần', 'Chân Lý', 'Đấng Sáng Tạo']
};

export const EXP_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500];

export const getUserRank = (exp: number = 0, system: RankSystem = 'NONE'): string => {
    if (system === 'NONE') return '';

    let level = 0;
    for (let i = EXP_THRESHOLDS.length - 1; i >= 0; i--) {
        if (exp >= EXP_THRESHOLDS[i]) {
            level = i;
            break;
        }
    }

    const titles = RANK_TITLES[system];
    return titles[level] || `Cấp ${level + 1}`;
};