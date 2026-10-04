/**
 * Ảnh banner khoá học do giảng viên tải lên là PNG gốc 3.5–4.5MB/tấm. Trang
 * /courses hiển thị 6 thẻ nên kéo về ~25MB chỉ để vẽ mấy khung ảnh rộng 400px.
 *
 * Supabase Storage có sẵn endpoint biến đổi ảnh: đổi /object/public/ thành
 * /render/image/public/ rồi thêm width/quality là nó trả ảnh đã resize, và tự
 * đổi sang WebP khi trình duyệt gửi Accept: image/webp. Cùng tấm banner đó:
 * 4.47MB PNG → 36KB WebP ở width=1200. Ảnh trong DB không đổi, chỉ đổi cách
 * lấy về lúc render.
 *
 * Nếu project Supabase không bật được transform (gói free), endpoint render sẽ
 * lỗi — nên mọi chỗ dùng đều kèm handleRemoteImageError để quay về URL gốc,
 * ảnh vẫn hiện, chỉ là không được tối ưu.
 */

const SUPABASE_OBJECT_SEGMENT = '/storage/v1/object/public/';
const SUPABASE_RENDER_SEGMENT = '/storage/v1/render/image/public/';

/** Chỉ ảnh nằm trong Supabase Storage mới biến đổi được. */
export function isSupabaseStorageUrl(url) {
  return typeof url === 'string' && url.includes(SUPABASE_OBJECT_SEGMENT);
}

/**
 * Trả URL ảnh đã resize. Ảnh không phải của Supabase (ảnh tĩnh trong public/,
 * link ngoài giảng viên dán vào) được trả nguyên vẹn.
 */
export function supabaseImageUrl(url, { width, quality = 72 } = {}) {
  if (!isSupabaseStorageUrl(url) || !width) {
    return url;
  }

  const [base, existingQuery] = url.split('?');
  const rendered = base.replace(SUPABASE_OBJECT_SEGMENT, SUPABASE_RENDER_SEGMENT);
  const params = new URLSearchParams(existingQuery || '');
  params.set('width', String(width));
  params.set('quality', String(quality));
  params.set('resize', 'contain');

  return `${rendered}?${params.toString()}`;
}

/**
 * srcset để trình duyệt tự chọn bề rộng hợp màn hình/DPR. Màn thường lấy bản
 * 400–800, màn Retina lấy 1200 — vẫn nhẹ hơn ảnh gốc hàng trăm lần.
 */
export function supabaseImageSrcSet(url, widths = [400, 800, 1200], quality = 72) {
  if (!isSupabaseStorageUrl(url)) {
    return undefined;
  }

  return widths.map((width) => `${supabaseImageUrl(url, { width, quality })} ${width}w`).join(', ');
}

/**
 * Dự phòng khi endpoint render không dùng được: gỡ srcset và trả src về URL
 * gốc. Gắn cờ dataset để không rơi vào vòng lặp onError vô tận nếu chính ảnh
 * gốc cũng hỏng.
 */
export function handleRemoteImageError(originalUrl) {
  return (event) => {
    const image = event.currentTarget;
    if (!originalUrl || image.dataset.cdnFallbackApplied === 'true') {
      return;
    }

    image.dataset.cdnFallbackApplied = 'true';
    image.removeAttribute('srcset');
    image.removeAttribute('sizes');
    image.src = originalUrl;
  };
}
