import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseExcelCourseFile, parseExcelQuestionFile } from './excelCourseParser';

// File Excel giả lập đúng cách app nhận: chỉ cần .arrayBuffer().
function toFile(rows, sheetName = 'Sheet1') {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return { arrayBuffer: async () => buffer };
}

describe('parseExcelQuestionFile', () => {
  // Tiêu đề tiếng Việt CÓ DẤU là dạng tài liệu hướng dẫn ghi (mục 5.1). Regex dò
  // cột từng bị hỏng mã hóa nên file này ra câu hỏi trắng lựa chọn và đáp án
  // mặc định về A — học viên không làm được mà giáo viên vẫn thấy báo thành công.
  it('đọc được tiêu đề tiếng Việt có dấu: Lựa chọn A, Đáp án, Giải thích', async () => {
    const questions = await parseExcelQuestionFile(
      toFile([
        ['Câu hỏi', 'Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D', 'Đáp án', 'Giải thích'],
        ['你好 nghĩa là gì?', 'xin chào', 'tạm biệt', 'cảm ơn', 'xin lỗi', 'A', 'Chào hỏi cơ bản'],
        ['谢谢 nghĩa là gì?', 'xin chào', 'cảm ơn', 'tạm biệt', 'xin lỗi', 'B', 'Cảm ơn']
      ])
    );

    expect(questions).toHaveLength(2);
    expect(questions[0].options.map((option) => option.text)).toEqual([
      'xin chào',
      'tạm biệt',
      'cảm ơn',
      'xin lỗi'
    ]);
    expect(questions[0].correctAnswer).toBe('A');
    expect(questions[0].explanation).toBe('Chào hỏi cơ bản');
    expect(questions[1].correctAnswer).toBe('B');
  });

  it('vẫn đọc được tiêu đề A/B/C/D và tiêu đề tiếng Anh', async () => {
    const shortHeaders = await parseExcelQuestionFile(
      toFile([
        ['Câu hỏi', 'A', 'B', 'C', 'D', 'Đáp án', 'Ghi chú'],
        ['再见 nghĩa là gì?', 'xin chào', 'cảm ơn', 'tạm biệt', 'xin lỗi', 'C', 'Tạm biệt']
      ])
    );
    expect(shortHeaders[0].correctAnswer).toBe('C');
    expect(shortHeaders[0].explanation).toBe('Tạm biệt');

    const englishHeaders = await parseExcelQuestionFile(
      toFile([
        ['Question', 'Option A', 'Option B', 'Answer', 'Explanation'],
        ['What does 你好 mean?', 'hello', 'bye', 'A', 'greeting']
      ])
    );
    expect(englishHeaders[0].correctAnswer).toBe('A');
  });

  // Đoán bừa đáp án A cho cả file là kiểu sai nguy hiểm nhất: bài trông vẫn
  // chấm được nhưng chấm sai. Để trống thì câu bị loại khỏi tổng điểm.
  it('không tự đoán đáp án khi cột Đáp án bỏ trống', async () => {
    const questions = await parseExcelQuestionFile(
      toFile([
        ['Câu hỏi', 'Lựa chọn A', 'Lựa chọn B', 'Đáp án'],
        ['Câu này chưa điền khóa', 'một', 'hai', '']
      ])
    );

    expect(questions[0].correctAnswer).toBe('');
  });

  // Chỉ dòng tiêu đề thật mới được bỏ. Câu hỏi có chữ "đáp án" trong nội dung
  // từng bị nuốt mất vì luật nhận diện tiêu đề dò chuỗi con.
  it('giữ lại câu hỏi có chữ "đáp án" / "lựa chọn" trong nội dung', async () => {
    const questions = await parseExcelQuestionFile(
      toFile([
        ['Câu hỏi', 'Lựa chọn A', 'Lựa chọn B', 'Đáp án'],
        ['Chọn đáp án đúng cho câu sau: 你好', 'xin chào', 'tạm biệt', 'A'],
        ['Lựa chọn nào là số đếm?', 'yī', 'nǐ', 'A']
      ])
    );

    expect(questions.map((question) => question.prompt)).toEqual([
      'Chọn đáp án đúng cho câu sau: 你好',
      'Lựa chọn nào là số đếm?'
    ]);
  });
});

describe('parseExcelCourseFile', () => {
  it('cắt bài theo cột Tên bài / Số bài / Dạng bài và nhận đáp án theo nhãn', async () => {
    const sections = await parseExcelCourseFile(
      toFile(
        [
          ['Tên bài', 'Số bài', 'Dạng bài', 'Câu số', 'Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D', 'Đáp án', 'Ghi chú'],
          ['Bài 1. Giới thiệu', '1', 'Luyện tập ngữ âm', '1', 'nǐ hǎo', 'ní hào', 'nì hāo', 'nī hǎo', 'A', 'Thanh 3'],
          ['', '', '', '2', '谢谢', '再见', '对不起', '没关系', 'A', 'Cảm ơn'],
          ['Bài 2. Số đếm', '2', 'Từ vựng', '1', 'yī', 'èr', 'sān', 'sì', 'B', '']
        ],
        'Chương 1'
      )
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('Chương 1');
    expect(sections[0].lessons).toHaveLength(2);
    expect(sections[0].lessons[0].questions).toHaveLength(2);
    expect(sections[0].lessons[1].questions[0].correctAnswer).toBe('B');
  });
});
