// Bộ nét cơ bản của chữ Hán dùng cho phần "Luyện nét chữ Hán".
//
// Hình nét được vẽ bằng SVG path thay vì file ảnh: ảnh gốc của khóa HSK 1 đã
// mất khi import (câu hỏi "Chọn tên gọi đúng của nét trong hình" không còn
// imageUrl), và path vẽ sẵn thì luôn nét ở mọi kích thước, không phụ thuộc font
// và hiển thị đúng ở cả nền sáng lẫn nền tối.
//
// Path vẽ trong khung 100×100, nét vẽ bằng stroke (không fill) nên đây là hình
// biểu diễn sơ đồ hướng đi của nét — đủ để nhận diện và phân biệt, không phải
// chữ thư pháp.
//
// `start` là điểm đặt bút, dùng để chấm dấu hướng viết.

export const CHINESE_STROKES = [
  // ----- 8 nét cơ bản -----
  {
    id: 'heng',
    vi: 'Nét ngang',
    zh: '横',
    pinyin: 'héng',
    example: '一',
    basic: true,
    start: [14, 55],
    path: 'M 14 55 L 86 46',
    tip: 'Kéo ngang từ trái sang phải, hơi chếch lên.'
  },
  {
    id: 'shu',
    vi: 'Nét sổ',
    zh: '竖',
    pinyin: 'shù',
    example: '十',
    basic: true,
    start: [50, 12],
    path: 'M 50 12 L 50 88',
    tip: 'Kéo thẳng từ trên xuống dưới.'
  },
  {
    id: 'pie',
    vi: 'Nét phẩy',
    zh: '撇',
    pinyin: 'piě',
    example: '八',
    basic: true,
    start: [74, 16],
    path: 'M 74 16 C 64 42 46 66 22 86',
    tip: 'Từ trên phải hất xuống dưới trái, cuối nét nhọn dần.'
  },
  {
    id: 'na',
    vi: 'Nét mác',
    zh: '捺',
    pinyin: 'nà',
    example: '八',
    basic: true,
    start: [24, 16],
    path: 'M 24 16 C 34 44 52 68 80 84',
    tip: 'Từ trên trái kéo xuống dưới phải, cuối nét bè ra.'
  },
  {
    id: 'dian',
    vi: 'Nét chấm',
    zh: '点',
    pinyin: 'diǎn',
    example: '六',
    basic: true,
    start: [42, 32],
    path: 'M 42 32 C 48 40 54 50 60 62',
    tip: 'Nét ngắn, chấm nhẹ theo hướng xuống phải.'
  },
  {
    id: 'ti',
    vi: 'Nét hất',
    zh: '提',
    pinyin: 'tí',
    example: '打',
    basic: true,
    start: [18, 74],
    path: 'M 18 74 L 82 34',
    tip: 'Hất chếch lên từ dưới trái sang trên phải.'
  },
  {
    id: 'henggou',
    vi: 'Nét ngang móc',
    zh: '横钩',
    pinyin: 'hénggōu',
    example: '你',
    basic: true,
    start: [16, 34],
    path: 'M 16 34 L 78 30 L 60 54',
    tip: 'Kéo ngang rồi móc chéo xuống trái.'
  },
  {
    id: 'shugou',
    vi: 'Nét sổ móc',
    zh: '竖钩',
    pinyin: 'shùgōu',
    example: '小',
    basic: true,
    start: [58, 12],
    path: 'M 58 12 L 58 70 C 58 84 44 86 32 80',
    tip: 'Sổ thẳng xuống rồi móc sang trái.'
  },

  // ----- Nét ghép -----
  {
    id: 'hengzhe',
    vi: 'Nét ngang gập',
    zh: '横折',
    pinyin: 'héngzhé',
    example: '口',
    start: [20, 24],
    path: 'M 20 24 L 74 20 L 78 84',
    tip: 'Kéo ngang rồi gập vuông góc xuống dưới.'
  },
  {
    id: 'hengpie',
    vi: 'Nét ngang phẩy',
    zh: '横撇',
    pinyin: 'héngpiě',
    example: '又',
    start: [18, 26],
    path: 'M 18 26 L 76 22 C 64 46 44 68 24 86',
    tip: 'Kéo ngang rồi chuyển thành nét phẩy xuống trái.'
  },
  {
    id: 'shuzhe',
    vi: 'Nét sổ gập',
    zh: '竖折',
    pinyin: 'shùzhé',
    example: '山',
    start: [30, 14],
    path: 'M 30 14 L 30 70 L 84 66',
    tip: 'Sổ xuống rồi gập sang phải.'
  },
  {
    id: 'shuti',
    vi: 'Nét sổ hất',
    zh: '竖提',
    pinyin: 'shùtí',
    example: '民',
    start: [34, 14],
    path: 'M 34 14 L 34 72 L 84 44',
    tip: 'Sổ xuống rồi hất chếch lên phải.'
  },
  {
    id: 'piedian',
    vi: 'Nét phẩy chấm',
    zh: '撇点',
    pinyin: 'piědiǎn',
    example: '女',
    start: [66, 16],
    path: 'M 66 16 C 56 38 44 54 30 64 C 44 72 56 80 68 88',
    tip: 'Phẩy xuống trái rồi chấm chéo xuống phải.'
  },
  {
    id: 'piezhe',
    vi: 'Nét phẩy gập',
    zh: '撇折',
    pinyin: 'piězhé',
    example: '么',
    start: [70, 16],
    path: 'M 70 16 C 60 36 46 52 30 64 L 82 62',
    tip: 'Phẩy xuống trái rồi gập ngang sang phải.'
  },
  {
    id: 'wangou',
    vi: 'Nét cong móc',
    zh: '弯钩',
    pinyin: 'wāngōu',
    example: '狗',
    start: [44, 12],
    path: 'M 44 12 C 58 34 62 58 58 74 C 56 84 44 86 32 80',
    tip: 'Cong nhẹ xuống rồi móc sang trái.'
  },
  {
    id: 'xiegou',
    vi: 'Nét xiên móc',
    zh: '斜钩',
    pinyin: 'xiégōu',
    example: '我',
    start: [24, 8],
    // Nét quét dài, chỉ hơi cong; móc cuối ngắn — cong sớm hoặc móc dài sẽ
    // thành hình chữ V, mất dáng vươn dài đặc trưng của nét này.
    path: 'M 24 8 C 40 34 56 62 78 84 L 88 70',
    tip: 'Kéo xiên dài xuống phải rồi hất móc lên.'
  },
  {
    id: 'wogou',
    vi: 'Nét nằm móc',
    zh: '卧钩',
    pinyin: 'wògōu',
    example: '心',
    start: [20, 26],
    path: 'M 20 26 C 28 60 52 78 80 72 L 64 52',
    tip: 'Cong nằm như lòng chảo rồi móc lên trái.'
  },
  {
    id: 'hengzhegou',
    vi: 'Nét ngang gập móc',
    zh: '横折钩',
    pinyin: 'héngzhégōu',
    example: '月',
    start: [20, 22],
    path: 'M 20 22 L 72 18 L 74 72 C 74 84 60 86 48 80',
    tip: 'Ngang, gập xuống, rồi móc sang trái.'
  },
  {
    id: 'hengzheti',
    vi: 'Nét ngang gập hất',
    zh: '横折提',
    pinyin: 'héngzhétí',
    example: '讠',
    start: [18, 26],
    path: 'M 18 26 L 66 22 L 38 62 L 86 48',
    tip: 'Ngang, gập chéo xuống trái, rồi hất lên phải.'
  },
  {
    id: 'shuwangou',
    vi: 'Nét sổ cong móc',
    zh: '竖弯钩',
    pinyin: 'shùwāngōu',
    example: '也',
    start: [40, 12],
    path: 'M 40 12 L 40 60 C 40 78 58 82 80 78 L 84 56',
    tip: 'Sổ xuống, lượn sang phải, rồi móc lên.'
  },
  {
    id: 'hengzhewangou',
    vi: 'Nét ngang gập cong móc',
    zh: '横折弯钩',
    pinyin: 'héngzhéwāngōu',
    example: '几',
    start: [22, 20],
    path: 'M 22 20 L 66 18 C 62 44 56 66 62 78 C 66 86 78 84 86 74',
    tip: 'Ngang, gập xuống, lượn cong rồi móc lên phải.'
  },
  {
    id: 'shuzhezhegou',
    vi: 'Nét sổ gập gập móc',
    zh: '竖折折钩',
    pinyin: 'shùzhézhégōu',
    example: '弓',
    start: [30, 14],
    path: 'M 30 14 L 30 40 L 72 38 L 72 66 C 72 80 56 84 42 78',
    tip: 'Sổ, gập phải, gập xuống, rồi móc sang trái.'
  },
  {
    id: 'hengpiewangou',
    vi: 'Nét ngang phẩy cong móc',
    zh: '横撇弯钩',
    pinyin: 'héngpiěwāngōu',
    example: '阝',
    start: [22, 20],
    path: 'M 22 20 L 60 16 C 52 38 44 56 50 70 C 54 82 68 82 78 74',
    tip: 'Ngang, phẩy xuống, lượn cong rồi móc lên.'
  },
  {
    id: 'hengzhezhezhegou',
    vi: 'Nét ngang gập gập gập móc',
    zh: '横折折折钩',
    pinyin: 'héngzhézhézhégōu',
    example: '乃',
    start: [20, 20],
    path: 'M 20 20 L 62 16 L 40 44 L 74 40 L 72 74 C 72 86 58 88 46 82',
    tip: 'Nét dài nhiều lần gập, kết bằng móc sang trái.'
  }
];

export const BASIC_STROKES = CHINESE_STROKES.filter((stroke) => stroke.basic);

export function getStrokeById(id) {
  return CHINESE_STROKES.find((stroke) => stroke.id === id) || null;
}

// So khớp tên nét tiếng Việt: bỏ dấu câu, hoa/thường và tiền tố "nét" để
// "Nét sổ móc", "sổ móc", "SỔ MÓC" đều tra ra cùng một nét.
export function normalizeStrokeName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/^\s*nét\s+/, '')
    .replace(/[.,!?;:"'“”‘’()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findStrokeByVietnameseName(name) {
  const normalized = normalizeStrokeName(name);
  if (!normalized) {
    return null;
  }

  return CHINESE_STROKES.find((stroke) => normalizeStrokeName(stroke.vi) === normalized) || null;
}
