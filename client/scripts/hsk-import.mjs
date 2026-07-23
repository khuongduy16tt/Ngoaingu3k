// Importer: đọc Google Sheet "HSK 1 - VỠ LÒNG" (và các sheet demo) → course JSON
// theo model lessons.content của app, rồi (tùy chế độ) ghi vào Supabase như khóa
// nháp. Chạy DRY-RUN mặc định (chỉ in tóm tắt). Thêm arg `--write` để ghi DB.
//
//   node client/scripts/hsk-import.mjs            # dry run, in summary
//   node client/scripts/hsk-import.mjs --sample   # dry run + in 1 chương mẫu
//   node client/scripts/hsk-import.mjs --write     # ghi vào Supabase (draft)
//
// Chạy từ thư mục client để resolve xlsx + @supabase/supabase-js.

import * as XLSX from 'xlsx';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const SHEET_ID = '1ACEg6vQm5IVWJedVjzXFePq0amZD8jrD61SOlNJUcuw'; // HSK 1 - VỠ LÒNG (full)
const COURSE_TITLE = 'HSK 1 - VỠ LÒNG';
const COURSE_SLUG = 'hsk-1-vo-long';
const OWNER_TEACHER_ID = '1210e768-6a4e-4514-9575-28ed8417869c'; // dotrithucnknd@gmail.com
const LESSON_CONTENT_VERSION = 'ngoaingu3k.lesson.v1';

// Thứ tự tab mong muốn (chapter = tab).
const TAB_ORDER = [
  'Ngữ âm',
  ...Array.from({ length: 15 }, (_, i) => `Chủ đề ${i + 1}`)
];

const OPTION_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const HANZI_RE = /[一-鿿]/;

function clean(v) {
  return String(v ?? '').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}
function oneLine(v) {
  return clean(v).replace(/\s*\n\s*/g, ' ').trim();
}
function stripLeadingNumber(v) {
  return clean(v).replace(/^\s*\d+\s*[.)．、]\s*/, '').trim();
}
function isNumeric(v) {
  return /^\s*\d+\s*[.)．、]?\s*$/.test(String(v ?? ''));
}

function parseOptions(cells) {
  return cells
    .map(clean)
    .filter(Boolean)
    .map((raw, index) => {
      const m = raw.match(/^([A-D])\s*[.)，,、]\s*(.+)$/i);
      return { label: OPTION_LABELS[index], text: m ? m[2].trim() : raw };
    });
}

function normalizeAnswerToLabel(answer, options) {
  const raw = clean(answer);
  const up = raw.toUpperCase().replace(/[^A-D]/g, '');
  if (['A', 'B', 'C', 'D'].includes(up)) return up;
  const byText = options.find((o) => o.text.toLowerCase() === raw.toLowerCase());
  return byText ? byText.label : up;
}

// "Đúng/Sai" → true_false. Trả về true nếu tập lựa chọn là đúng/sai.
function isTrueFalseOptions(options) {
  const texts = options.map((o) => o.text.toLowerCase());
  return (
    texts.length >= 2 &&
    texts.every((t) => /^(đúng|sai|dung|true|false)$/.test(t)) &&
    texts.some((t) => /đúng|dung|true/.test(t)) &&
    texts.some((t) => /sai|false/.test(t))
  );
}

// Tách chữ Hán để render lớn thay ảnh: "Chèn ảnh chữ 八" / "Ảnh ... chữ 小".
function extractImageHanzi(note) {
  const m = clean(note).match(/ch(?:ữ|u)\s*([一-鿿]{1,4})/i);
  if (m) return m[1];
  // note chỉ gồm 1-4 hán tự (một số ô ghi thẳng chữ)
  const only = clean(note);
  if (only && only.length <= 4 && [...only].every((ch) => HANZI_RE.test(ch))) return only;
  return '';
}

// Bỏ các chỉ dẫn asset khỏi phần giải thích hiển thị cho học viên.
function cleanExplanation(note) {
  return clean(note)
    .split('\n')
    .filter((line) => {
      const l = line.trim();
      if (!l) return false;
      if (/^giao di[eệ]n\s*[:：]/i.test(l)) return false;
      if (/^ch[eè]n\s*[aả]nh/i.test(l)) return false;
      if (/^[aả]nh\s+/i.test(l) && /\.(jpg|png|jpeg)/i.test(l)) return false;
      if (/^[aả]nh\s+[^.]*$/i.test(l) && l.length < 30) return false; // "Ảnh nét ngang"
      // Ghi chú kỹ thuật cho dev (không phải nội dung học viên).
      if (/^\(.*hi[eệ]n ra sau khi.*\)$/i.test(l)) return false;
      return true;
    })
    .join('\n')
    .replace(/^gi[aả]i th[ií]ch\s*[:：]\s*/i, 'Giải thích: ')
    .trim();
}

function slugId(prefix, n) {
  return `${prefix}-${n}`;
}

// ---- Parse 1 sheet (tab) → chapter ----
function parseTab(sheetName, sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  // header row chứa "Tên bài"/"Đáp án"/"Dạng bài"
  const headerIdx = rows.findIndex((r) => r.some((c) => /tên bài|đáp án|dạng bài/i.test(clean(c))));
  const body = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows;

  const chapter = { tab: sheetName, lessons: [] };
  let tenBai = '';
  let curLesson = null;

  const finishLesson = () => {
    if (curLesson && (curLesson.exercises.length || curLesson.readingItems.length || curLesson.isPinyinTable)) {
      chapter.lessons.push(curLesson);
    }
    curLesson = null;
  };

  body.forEach((row, ri) => {
    const c0 = clean(row[0]); // Tên bài
    const c1 = clean(row[1]); // Bài
    const c2 = clean(row[2]); // Dạng bài
    const c3 = clean(row[3]); // Câu (số hoặc prompt)
    const optRaw = [row[4], row[5], row[6], row[7]];
    const c8 = clean(row[8]); // Đáp án
    const c9 = clean(row[9]); // Ghi chú

    if (c0) tenBai = oneLine(c0);

    // Xử lý ranh giới bài TRƯỚC, rồi mới bỏ phần "nhãn A/B" — vì hàng nhãn
    // đôi khi cũng mang metadata mở bài mới (Bài 2: Nghe và chọn thanh mẫu | A | B).
    const startsNewLesson = Boolean(c1 || c2) && (!curLesson || (c1 && c1 !== curLesson.bai) || (c2 && c2 !== curLesson.dangBai));
    if (startsNewLesson) {
      finishLesson();
      const dang = c2 || (curLesson ? curLesson.dangBai : '') || 'Bài học';
      curLesson = {
        tenBai,
        bai: c1 || (curLesson ? curLesson.bai : ''),
        dangBai: dang,
        title: [tenBai, dang].filter(Boolean).join(' · ') || `${sheetName} — Bài`,
        exercises: [],
        readingItems: [],
        isPinyinTable: false,
        note: ''
      };
    }
    if (!curLesson) {
      if (!(c3 || optRaw.some((c) => clean(c)) || c8)) return;
      curLesson = { tenBai, bai: c1, dangBai: c2 || 'Bài học', title: [tenBai, c2].filter(Boolean).join(' · ') || sheetName, exercises: [], readingItems: [], isPinyinTable: false, note: '' };
    }

    // Hàng chỉ là nhãn cột lựa chọn (A/B, không câu/đáp án) → bỏ, không tạo câu hỏi.
    const oh = [clean(row[4]), clean(row[5]), clean(row[6]), clean(row[7])];
    if (oh[0].toUpperCase() === 'A' && oh[1].toUpperCase() === 'B' && !c8 && !c3) return;

    const options = parseOptions(optRaw);
    const dangLower = curLesson.dangBai.toLowerCase();

    // 1) "Đọc bảng phiên âm" → bài bảng pinyin (không câu hỏi)
    if (/đọc bảng phiên âm/i.test(curLesson.dangBai)) {
      curLesson.isPinyinTable = true;
      if (c9) curLesson.note = oneLine(c9);
      return;
    }

    // 2) Có lựa chọn → câu hỏi (MCQ / true_false)
    if (options.length >= 2) {
      const promptText = isNumeric(c3) || !c3 ? '' : stripLeadingNumber(c3);
      const explanation = cleanExplanation(c9);
      const imageHanzi = extractImageHanzi(c9);
      const tf = isTrueFalseOptions(options);
      const idx = curLesson.exercises.length + 1;

      if (tf) {
        const ansLabel = normalizeAnswerToLabel(c8, options);
        const ansOpt = options.find((o) => o.label === ansLabel);
        const isTrue = ansOpt ? /đúng|dung|true/i.test(ansOpt.text) : true;
        curLesson.exercises.push({
          id: slugId(`${sheetName}-l${chapter.lessons.length}-q`, `${idx}-${ri}`),
          type: 'true_false',
          prompt: promptText || curLesson.dangBai,
          correctAnswer: isTrue ? 'true' : 'false',
          imageHanzi,
          explanation
        });
      } else {
        const isListening = /nghe/i.test(dangLower);
        curLesson.exercises.push({
          id: slugId(`${sheetName}-l${chapter.lessons.length}-q`, `${idx}-${ri}`),
          type: 'multiple_choice',
          prompt: promptText || curLesson.dangBai,
          options,
          correctAnswer: normalizeAnswerToLabel(c8, options),
          audioPending: isListening,
          imageHanzi,
          explanation
        });
      }
      return;
    }

    // 3) Không lựa chọn nhưng có nội dung ở cột Câu → mục luyện đọc
    if (c3 && !isNumeric(c3)) {
      curLesson.readingItems.push(clean(c3));
    } else if (isNumeric(c3) && (clean(row[4]) || clean(row[3]))) {
      // hàng chỉ có số thứ tự + nội dung? bỏ qua nếu không có gì
    }
    if (c9 && !curLesson.note) curLesson.note = oneLine(c9);
  });

  finishLesson();
  return chapter;
}

// ---- Build course JSON (sections/lessons theo model app) ----
function buildCourse(chapters) {
  const sections = chapters.map((chapter) => ({
    title: chapter.tab,
    lessons: chapter.lessons.map((lesson, li) => {
      const exercises = lesson.exercises.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        options: q.type === 'multiple_choice' ? q.options : [],
        correctAnswer: q.correctAnswer,
        acceptedAnswers: [],
        pairs: [],
        sampleAnswer: '',
        audioUrl: '',
        audioName: '',
        imageHanzi: q.imageHanzi || '',
        audioPending: Boolean(q.audioPending),
        explanation: q.explanation || ''
      }));
      const exerciseType = lesson.isPinyinTable
        ? 'Bảng phiên âm'
        : lesson.readingItems.length && !exercises.length
          ? 'Luyện đọc'
          : lesson.dangBai;
      return {
        title: lesson.title,
        exerciseType,
        note: lesson.note || lesson.tenBai || '',
        readingItems: lesson.readingItems,
        pinyinTable: lesson.isPinyinTable ? inferPinyinTableKey(lesson) : '',
        exercises,
        questionCount: exercises.length
      };
    })
  }));
  return { title: COURSE_TITLE, slug: COURSE_SLUG, sections };
}

function inferPinyinTableKey(lesson) {
  const hay = `${lesson.tenBai} ${lesson.note}`.toLowerCase();
  if (/an en ang eng ong|vận mẫu/.test(hay)) return 'finals';
  return 'initials';
}

// ---- Fetch workbook ----
async function fetchWorkbook(id) {
  const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch xlsx failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return XLSX.read(buf, { type: 'buffer' });
}

function loadServiceEnv() {
  const envPath = path.resolve(REPO_ROOT, 'server', '.env');
  const env = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    let val = t.slice(i + 1).trim();
    if ((val[0] === '"' || val[0] === "'") && val.endsWith(val[0])) val = val.slice(1, -1);
    env[t.slice(0, i).trim()] = val;
  }
  return env;
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const sample = args.includes('--sample');

  const wb = await fetchWorkbook(SHEET_ID);
  const available = wb.SheetNames;
  const tabs = TAB_ORDER.filter((t) => available.includes(t));
  const chapters = tabs.map((t) => parseTab(t, wb.Sheets[t]));
  const course = buildCourse(chapters);

  // Gắn video (từ Drive folder) cho mọi bài học.
  let videoMap = {};
  try {
    videoMap = JSON.parse(readFileSync(path.resolve(__dirname, 'videomap.json'), 'utf8'));
  } catch {
    console.warn('Chưa có videomap.json — chạy fetch-videos.mjs trước để gắn video.');
  }
  assignVideos(course, videoMap);
  const withVideo = course.sections.reduce((s, sec) => s + sec.lessons.filter((l) => l.videoUrl).length, 0);
  const totalL = course.sections.reduce((s, sec) => s + sec.lessons.length, 0);
  console.log(`Video: ${withVideo}/${totalL} bài học có video`);

  // Summary
  let totalLessons = 0, totalQ = 0, totalTF = 0, totalMC = 0, totalListen = 0, totalReading = 0, totalPinyin = 0, totalHanzi = 0, noQ = 0;
  console.log(`\n=== ${course.title} (${course.sections.length} chương) ===`);
  for (const s of course.sections) {
    let sQ = 0;
    for (const l of s.lessons) {
      totalLessons++;
      sQ += l.exercises.length;
      totalQ += l.exercises.length;
      for (const q of l.exercises) {
        if (q.type === 'true_false') totalTF++; else totalMC++;
        if (q.audioPending) totalListen++;
        if (q.imageHanzi) totalHanzi++;
      }
      if (l.readingItems.length) totalReading++;
      if (l.pinyinTable) totalPinyin++;
      if (!l.exercises.length && !l.readingItems.length && !l.pinyinTable) noQ++;
    }
    console.log(`  • ${s.title}: ${s.lessons.length} bài, ${sQ} câu`);
  }
  console.log(`\nTổng: ${totalLessons} bài học · ${totalQ} câu (MC ${totalMC}, T/F ${totalTF}) · ${totalListen} câu nghe (chờ audio) · ${totalReading} bài luyện đọc · ${totalPinyin} bảng phiên âm · ${totalHanzi} câu có chữ Hán thay ảnh · ${noQ} bài rỗng`);

  writeFileSync(path.resolve(__dirname, 'hsk1-course.json'), JSON.stringify(course, null, 2));
  console.log(`\nĐã ghi JSON: client/scripts/hsk1-course.json`);

  if (sample) {
    const s = course.sections.find((x) => x.lessons.length) || course.sections[0];
    console.log('\n=== SAMPLE CHƯƠNG:', s.title, '===');
    console.log(JSON.stringify(s.lessons.slice(0, 3), null, 2));
  }

  if (!write) {
    console.log('\n(DRY RUN — chưa ghi DB. Thêm --write để ghi Supabase draft.)');
    return;
  }

  const env = loadServiceEnv();
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  await writeCourse(supabase, course);
}

// Gắn video cho MỌI bài học: round-robin video của chương (theo Drive folder),
// chương nào không có (VD Chủ đề 2) thì lấy từ pool chung ("thêm bừa" theo yêu cầu).
function assignVideos(course, videoMap) {
  const toUrl = (id) => `https://drive.google.com/file/d/${id}/view`;
  const pool = Object.values(videoMap).flat();
  let g = 0;
  for (const section of course.sections) {
    const vids = videoMap[section.title] && videoMap[section.title].length ? videoMap[section.title] : null;
    section.lessons.forEach((lesson, i) => {
      const id = vids ? vids[i % vids.length] : pool.length ? pool[g++ % pool.length] : '';
      lesson.videoUrl = id ? toUrl(id) : '';
    });
  }
}

function buildLessonContent(lesson, position) {
  return {
    version: LESSON_CONTENT_VERSION,
    videoUrl: lesson.videoUrl || '',
    note: lesson.note || '',
    lessonNumber: String(position),
    exerciseType: lesson.exerciseType || 'Bài học',
    questionCount: lesson.exercises.length,
    sourceSheet: lesson.title,
    videoTitle: lesson.title,
    readingItems: lesson.readingItems || [],
    pinyinTable: lesson.pinyinTable || '',
    exercises: lesson.exercises
  };
}

async function writeCourse(supabase, course) {
  const { randomUUID } = await import('node:crypto');
  console.log('\nGhi khóa học (draft) vào Supabase...');
  // Course (draft)
  const { data: existing } = await supabase.from('courses').select('id').eq('slug', course.slug).maybeSingle();
  let courseId = existing?.id;
  const coursePayload = {
    slug: course.slug,
    title: course.title,
    description: 'Khóa HSK 1 vỡ lòng: ngữ âm và 15 chủ đề — mỗi bài có video bài giảng kèm luyện tập (trắc nghiệm, đúng/sai, luyện đọc, bảng phiên âm).',
    price: 0,
    status: 'draft',
    teacher_id: OWNER_TEACHER_ID,
    banner_url: null
  };
  if (courseId) {
    await supabase.from('courses').update(coursePayload).eq('id', courseId);
  } else {
    const { data, error } = await supabase.from('courses').insert(coursePayload).select('id').single();
    if (error) throw error;
    courseId = data.id;
  }
  console.log('courseId:', courseId);

  // Xóa chapters/lessons cũ của khóa này (nếu import lại)
  const { data: oldChapters } = await supabase.from('chapters').select('id').eq('course_id', courseId);
  const oldIds = (oldChapters || []).map((c) => c.id);
  if (oldIds.length) {
    await supabase.from('lessons').delete().in('chapter_id', oldIds);
    await supabase.from('chapters').delete().eq('course_id', courseId);
  }

  let chapterPos = 0;
  for (const section of course.sections) {
    chapterPos++;
    const { data: chapter, error: chErr } = await supabase
      .from('chapters')
      .insert({ course_id: courseId, title: section.title, position: chapterPos })
      .select('id')
      .single();
    if (chErr) throw chErr;

    const lessonRows = section.lessons.map((lesson, li) => ({
      id: randomUUID(),
      chapter_id: chapter.id,
      title: lesson.title,
      video_url: lesson.videoUrl || null,
      content: buildLessonContent(lesson, li + 1),
      position: li + 1,
      is_preview: chapterPos === 1 && li === 0
    }));
    if (lessonRows.length) {
      const { error: lErr } = await supabase.from('lessons').insert(lessonRows);
      if (lErr) throw lErr;
    }
    process.stdout.write(`  ✓ ${section.title} (${lessonRows.length})\n`);
  }
  console.log('\nXONG. Khóa học đã ở chế độ DRAFT.');
}

main().catch((e) => {
  console.error('LỖI:', e.message);
  process.exit(1);
});
