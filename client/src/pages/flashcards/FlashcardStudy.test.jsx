import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { FlashcardStudy } from './FlashcardStudy';
import { createEmptyProgress, MASTERY_STREAK } from '../../lib/flashcardStudy';

// jsdom không có AudioContext nên phần âm thanh tự no-op; ở đây kiểm tra phần
// nhìn thấy được: hai mặt thẻ cùng trong DOM, lớp lật, canvas pháo hoa và nút
// tắt tiếng.

const cards = [
  { id: 'c1', term: '你好', definition: 'xin chào', position: 0 },
  { id: 'c2', term: '谢谢', definition: 'cảm ơn', position: 1 },
  { id: 'c3', term: '再见', definition: 'tạm biệt', position: 2 },
  { id: 'c4', term: '请', definition: 'mời', position: 3 }
];

const set = { id: 'set-1', title: 'Bộ thử', courseTitle: 'HSK 1', description: '', cards };

function renderStudy(progress = createEmptyProgress(cards), onProgressChange = () => {}) {
  return render(<FlashcardStudy set={set} progress={progress} onProgressChange={onProgressChange} />);
}

describe('hiệu ứng lật thẻ', () => {
  beforeEach(() => localStorage.clear());

  it('render cả hai mặt cùng lúc để lật 3D không bị đổi chữ giữa lúc xoay', () => {
    const { container } = renderStudy();
    const front = container.querySelector('.fc-card--front .fc-card__text');
    const back = container.querySelector('.fc-card--back .fc-card__text');

    expect(front.textContent).toBe('你好');
    expect(back.textContent).toBe('xin chào');
  });

  it('bấm thẻ thì bật lớp is-flipped, bấm lại thì tắt', () => {
    const { container } = renderStudy();
    const scene = container.querySelector('.fc-card-scene');
    const button = screen.getByRole('button', { name: 'Lật thẻ' });

    expect(scene.className).not.toMatch(/is-flipped/);
    fireEvent.click(button);
    expect(scene.className).toMatch(/is-flipped/);
    fireEvent.click(button);
    expect(scene.className).not.toMatch(/is-flipped/);
  });

  it('đảo mặt hiện trước thì đổi nội dung hai mặt', () => {
    const { container } = renderStudy();
    fireEvent.click(screen.getByRole('button', { name: /Hiện thuật ngữ trước/ }));

    expect(container.querySelector('.fc-card--front .fc-card__text').textContent).toBe('xin chào');
    expect(container.querySelector('.fc-card--back .fc-card__text').textContent).toBe('你好');
  });

  it('chuyển thẻ thì thẻ mới về mặt trước', () => {
    const { container } = renderStudy();
    fireEvent.click(screen.getByRole('button', { name: 'Lật thẻ' }));
    expect(container.querySelector('.fc-card-scene').className).toMatch(/is-flipped/);

    fireEvent.click(screen.getByRole('button', { name: /Sau/ }));
    expect(container.querySelector('.fc-card-scene').className).not.toMatch(/is-flipped/);
    expect(container.querySelector('.fc-card--front .fc-card__text').textContent).toBe('谢谢');
  });
});

describe('nút tắt tiếng', () => {
  beforeEach(() => localStorage.clear());

  it('mặc định đang bật và đổi được trạng thái', () => {
    const { container } = renderStudy();
    const toggle = container.querySelector('.fc-sound-toggle');

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle);
    expect(container.querySelector('.fc-sound-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Đang tắt tiếng')).toBeInTheDocument();
  });

  it('nhớ lựa chọn cho lần vào sau', () => {
    const first = renderStudy();
    fireEvent.click(first.container.querySelector('.fc-sound-toggle'));
    first.unmount();

    const second = renderStudy();
    expect(second.container.querySelector('.fc-sound-toggle')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('pháo hoa khi hoàn thành', () => {
  beforeEach(() => localStorage.clear());

  it('chưa thuộc hết thì chưa có pháo hoa', () => {
    const { container } = renderStudy();
    fireEvent.click(screen.getByRole('tab', { name: 'Học' }));
    expect(container.querySelector('.fireworks-canvas')).not.toBeInTheDocument();
  });

  it('thuộc hết cả bộ thì hiện pháo hoa kèm lời chúc', () => {
    const mastered = cards.reduce((map, card) => {
      map[card.id] = { correctStreak: MASTERY_STREAK, wrongCount: 0, mastered: true };
      return map;
    }, {});

    const { container } = renderStudy(mastered);
    fireEvent.click(screen.getByRole('tab', { name: 'Học' }));

    expect(screen.getByText(`Đã thuộc hết ${cards.length} thẻ 🎉`)).toBeInTheDocument();
    expect(container.querySelector('.fireworks-canvas')).toBeInTheDocument();
    expect(container.querySelector('.fc-done--celebrate')).toBeInTheDocument();
  });

  it('ghép hết các cặp thì hiện pháo hoa', () => {
    const { container } = renderStudy();
    fireEvent.click(screen.getByRole('tab', { name: 'Ghép cặp' }));

    // Ghép lần lượt từng cặp: chọn ô thuật ngữ rồi ô định nghĩa cùng thẻ.
    cards.forEach((card) => {
      const tiles = [...container.querySelectorAll('.fc-tile')];
      const term = tiles.find((tile) => tile.textContent === card.term);
      const definition = tiles.find((tile) => tile.textContent === card.definition);
      fireEvent.click(term);
      fireEvent.click(definition);
    });

    expect(screen.getByText(new RegExp(`Xong ${cards.length} cặp`))).toBeInTheDocument();
    expect(container.querySelector('.fireworks-canvas')).toBeInTheDocument();
  });

  it('kiểm tra đúng hết cả đề thì hiện pháo hoa', () => {
    const { container } = renderStudy();
    fireEvent.click(screen.getByRole('tab', { name: 'Kiểm tra' }));

    // Chỉ để lại dạng trắc nghiệm để chọn được đáp án đúng một cách xác định.
    fireEvent.click(screen.getByRole('button', { name: 'Đúng / Sai' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gõ đáp án' }));

    const items = [...container.querySelectorAll('.fc-test__item')];
    items.forEach((item) => {
      const term = item.querySelector('.fc-test__prompt strong').textContent;
      const answer = cards.find((card) => card.term === term).definition;
      const option = [...item.querySelectorAll('.fc-option')].find((b) => b.textContent === answer);
      fireEvent.click(option);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Nộp bài' }));

    expect(screen.getByText(`Đúng cả ${items.length} câu 🎉`)).toBeInTheDocument();
    expect(container.querySelector('.fireworks-canvas')).toBeInTheDocument();
  });

  it('kiểm tra sai một câu thì không có pháo hoa', () => {
    const { container } = renderStudy();
    fireEvent.click(screen.getByRole('tab', { name: 'Kiểm tra' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đúng / Sai' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gõ đáp án' }));

    const items = [...container.querySelectorAll('.fc-test__item')];
    items.forEach((item, index) => {
      const term = item.querySelector('.fc-test__prompt strong').textContent;
      const correct = cards.find((card) => card.term === term).definition;
      const options = [...item.querySelectorAll('.fc-option')];
      // Câu đầu chọn sai, các câu sau chọn đúng.
      const target =
        index === 0 ? options.find((b) => b.textContent !== correct) : options.find((b) => b.textContent === correct);
      fireEvent.click(target);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Nộp bài' }));

    expect(container.querySelector('.fireworks-canvas')).not.toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Kết quả: ${items.length - 1}/${items.length}`))).toBeInTheDocument();
  });
});

describe('chế độ Học vẫn chấm đúng sau khi thêm âm thanh', () => {
  beforeEach(() => localStorage.clear());

  it('trả lời sai thì hiện đáp án đúng và báo lên trang', () => {
    const changes = [];
    const { container } = renderStudy(createEmptyProgress(cards), (next, cardId) =>
      changes.push({ next, cardId })
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Học' }));
    const item = container.querySelector('.fc-question');
    const term = item.querySelector('h3').textContent;
    const correct = cards.find((card) => card.term === term).definition;
    const wrong = [...item.querySelectorAll('.fc-option')].find((b) => b.textContent !== correct);

    fireEvent.click(wrong);
    expect(within(item).getByText(`Đáp án đúng: ${correct}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    expect(changes).toHaveLength(1);
    // Trang cần id thẻ để chỉ lưu đúng một dòng tiến độ.
    expect(changes[0].cardId).toBeTruthy();
    expect(changes[0].next[changes[0].cardId].wrongCount).toBe(1);
  });
});
