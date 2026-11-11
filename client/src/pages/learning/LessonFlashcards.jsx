import React, { useEffect, useState } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import {
  getFlashcardProgress,
  getFlashcardSetById,
  getFlashcardSets,
  saveFlashcardProgress
} from '../../lib/flashcardService';
import { createEmptyProgress } from '../../lib/flashcardStudy';
import { FlashcardStudy } from '../flashcards/FlashcardStudy';

// Bài không có video (vd. khóa "HSK 5 - Từ vựng") thì hiện bộ flashcard cùng
// chủ đề thay cho video. Ghép theo số cuối tên: chương "Chủ đề 15" ↔ bộ thẻ
// "HSK 5 - Chủ đề 15" của cùng khóa.

const setListCache = new Map(); // courseId → Promise<danh sách bộ thẻ>
const fullSetCache = new Map(); // setId → Promise<bộ thẻ đủ nội dung>

function trailingNumber(text) {
  const match = String(text || '').trim().match(/(\d+)\s*$/);
  return match ? Number(match[1]) : null;
}

function loadSetList(courseId) {
  if (!setListCache.has(courseId)) {
    const promise = getFlashcardSets({ courseIds: [courseId] }).catch((error) => {
      setListCache.delete(courseId);
      throw error;
    });
    setListCache.set(courseId, promise);
  }
  return setListCache.get(courseId);
}

function loadFullSet(setId) {
  if (!fullSetCache.has(setId)) {
    const promise = getFlashcardSetById(setId).then((set) => {
      if (!set) fullSetCache.delete(setId);
      return set;
    });
    fullSetCache.set(setId, promise);
  }
  return fullSetCache.get(setId);
}

/**
 * Tìm bộ thẻ của chương đang học. `enabled = false` (bài đã có video) thì bỏ qua.
 * @returns {{ set: object|null, loading: boolean }}
 */
export function useLessonFlashcardSet({ courseId, chapterTitle, enabled }) {
  const number = trailingNumber(chapterTitle);
  const active = Boolean(enabled && courseId && number !== null);
  const [state, setState] = useState({ key: '', set: null, loading: active });
  const key = active ? `${courseId}:${number}` : '';

  useEffect(() => {
    if (!active) {
      setState({ key: '', set: null, loading: false });
      return undefined;
    }

    let cancelled = false;
    setState({ key, set: null, loading: true });

    (async () => {
      try {
        const sets = await loadSetList(courseId);
        const match = sets.find((set) => trailingNumber(set.title) === number);
        const full = match ? await loadFullSet(match.id) : null;
        if (!cancelled) setState({ key, set: full?.cards?.length ? full : null, loading: false });
      } catch {
        if (!cancelled) setState({ key, set: null, loading: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, key]);

  // Vừa đổi bài mà effect chưa chạy → coi như đang tải, tránh hiện thẻ của bài cũ.
  if (state.key !== key) {
    return { set: null, loading: active };
  }
  return { set: state.set, loading: state.loading };
}

export function LessonFlashcardPanel({ set }) {
  const auth = useAuth();
  const userId = auth.user?.id;
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setProgress(null);
    getFlashcardProgress({ userId, setId: set.id })
      .then((stored) => {
        if (cancelled) return;
        const own = Object.fromEntries(
          (set.cards || []).filter((card) => stored?.[card.id]).map((card) => [card.id, stored[card.id]])
        );
        setProgress(Object.keys(own).length ? { ...createEmptyProgress(set.cards), ...own } : createEmptyProgress(set.cards));
      })
      .catch(() => {
        if (!cancelled) setProgress(createEmptyProgress(set.cards));
      });
    return () => {
      cancelled = true;
    };
  }, [set.id, userId]);

  function handleProgressChange(nextProgress, changedCardId) {
    setProgress(nextProgress);
    if (!userId) return;
    const payload = changedCardId ? { [changedCardId]: nextProgress[changedCardId] } : nextProgress;
    void saveFlashcardProgress({ userId, setId: set.id, progress: payload });
  }

  if (!progress) {
    return (
      <section className="content-card content-card--enterprise video-question-empty">
        <p>Đang tải thẻ...</p>
      </section>
    );
  }

  return <FlashcardStudy set={set} progress={progress} onProgressChange={handleProgressChange} />;
}
