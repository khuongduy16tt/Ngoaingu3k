import { Router } from 'express';
import { supabaseAdmin, isSupabaseAdminReady } from '../config/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  buildPaymentTarget,
  extractTransferCode,
  isSepayReady,
  makeTransferCode,
  verifySepayApiKey,
  getSepayPgClient,
  isSepayPgReady
} from '../config/sepay.js';

const router = Router();

const MIGRATION_HINT =
  'Thiếu cột transfer_code/paid_at trên bảng orders. Chạy supabase/sepay-payment-migration.sql trong Supabase SQL editor.';

/** Cột của migration SePay chưa được chạy → báo rõ thay vì "Lỗi máy chủ". */
function isMissingSepayColumn(error) {
  if (!error) return false;
  const code = error.code || '';
  const message = `${error.message || ''} ${error.details || ''}`;
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    /transfer_code|paid_at|sepay_ref/.test(message)
  );
}

function toPaymentResponse(order, extra = {}) {
  const amount = Number(order.amount || 0);

  return {
    orderId: order.id,
    amount,
    status: order.status,
    paidAt: order.paid_at || null,
    ...buildPaymentTarget({ amount, transferCode: order.transfer_code }),
    ...extra
  };
}

function getPgExtra(req, order, courseId) {
  if (!isSepayPgReady() || !order || order.status === 'paid') return {};
  
  const sepayPgClient = getSepayPgClient();
  if (!sepayPgClient) return {};
  
  const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
  const checkoutURL = sepayPgClient.checkout.initCheckoutUrl();
  const checkoutFormfields = sepayPgClient.checkout.initOneTimePaymentFields({
    payment_method: 'BANK_TRANSFER',
    order_invoice_number: String(order.id),
    order_amount: Number(order.amount || 0),
    currency: 'VND',
    order_description: order.transfer_code || String(order.id),
    success_url: `${origin}/courses/${courseId}?payment=success`,
    error_url: `${origin}/courses/${courseId}?payment=error`,
    cancel_url: `${origin}/courses/${courseId}?payment=cancel`,
  });
  
  return { checkoutURL, checkoutFormfields };
}

/**
 * Đơn mới cần một mã chuyển khoản chưa ai dùng. Mã bốc ngẫu nhiên nên vẫn có
 * xác suất đụng nhau — gặp lỗi unique thì bốc lại.
 */
async function createOrderWithTransferCode({ userId, courseId, amount }) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: userId,
        course_id: courseId,
        provider: 'sepay',
        status: 'pending',
        amount,
        transfer_code: makeTransferCode()
      })
      .select('id, status, amount, transfer_code, paid_at')
      .single();

    if (!error) {
      return { order: data };
    }

    if (error.code !== '23505') {
      return { error };
    }
  }

  return { error: { message: 'Không tạo được mã chuyển khoản duy nhất.' } };
}

/**
 * POST /api/payments/checkout
 * Tạo đơn và trả về mã chuyển khoản + QR SePay. Tiền về sẽ do webhook SePay
 * xác nhận, không ai phải bấm "tôi đã chuyển khoản" nữa.
 */
router.post('/checkout', requireAuth, validate(['courseId']), async (req, res) => {
  const { courseId } = req.body;
  const userId = req.user.id;

  if (!isSupabaseAdminReady()) {
    const mockOrderId = `mock-order-${Date.now()}`;
    const transferCode = makeTransferCode();
    return res.json({
      message: 'Đơn hàng mock (chưa cấu hình Supabase).',
      orderId: mockOrderId,
      amount: Number(req.body.amount || 0),
      status: 'pending',
      mode: 'mock',
      ...buildPaymentTarget({ amount: req.body.amount, transferCode })
    });
  }

  try {
    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('id, price, status')
      .eq('id', courseId)
      .maybeSingle();

    if (courseError || !course || course.status !== 'published') {
      return res.status(404).json({ message: 'Khóa học không khả dụng để thanh toán.' });
    }

    // Giá lấy từ DB, không tin số tiền client gửi lên.
    const trustedAmount = Number(course.price || 0);

    const { data: openOrders, error: openOrderError } = await supabaseAdmin
      .from('orders')
      .select('id, status, amount, transfer_code, paid_at')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .in('status', ['paid', 'pending'])
      .order('created_at', { ascending: false });

    if (openOrderError && isMissingSepayColumn(openOrderError)) {
      return res.status(500).json({ message: MIGRATION_HINT });
    }

    const paidOrder = (openOrders || []).find((order) => order.status === 'paid');
    if (paidOrder) {
      return res.json({
        message: 'Bạn đã mua khóa học này.',
        mode: 'existing',
        ...toPaymentResponse(paidOrder)
      });
    }

    // Học viên bấm mua lại khi chưa chuyển tiền: dùng lại đúng mã cũ, nếu không
    // mã trên QR sẽ khác mã họ đang định chuyển.
    const pendingOrder = (openOrders || []).find(
      (order) => order.status === 'pending' && order.transfer_code
    );
    if (pendingOrder) {
      return res.json({
        message: 'Đơn đang chờ chuyển khoản.',
        mode: 'reused',
        ...toPaymentResponse(pendingOrder, getPgExtra(req, pendingOrder, courseId))
      });
    }

    const { order, error } = await createOrderWithTransferCode({
      userId,
      courseId,
      amount: trustedAmount
    });

    if (error) {
      if (isMissingSepayColumn(error)) {
        return res.status(500).json({ message: MIGRATION_HINT });
      }
      console.error('[POST /api/payments/checkout]', error.message);
      return res.status(500).json({ message: 'Không thể tạo đơn hàng.' });
    }

    return res.json({
      message: 'Đơn hàng đã được tạo, chờ chuyển khoản.',
      mode: 'supabase',
      sepayReady: isSepayReady(),
      ...toPaymentResponse(order, getPgExtra(req, order, courseId))
    });
  } catch (err) {
    console.error('[POST /api/payments/checkout]', err.message);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
});

/**
 * GET /api/payments/:orderId/status
 * Màn thanh toán hỏi lại endpoint này vài giây một lần để biết tiền đã về chưa.
 */
router.get('/:orderId/status', requireAuth, async (req, res) => {
  const { orderId } = req.params;

  if (!isSupabaseAdminReady()) {
    return res.json({ orderId, status: 'pending', mode: 'mock' });
  }

  try {
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, course_id, status, amount, transfer_code, paid_at')
      .eq('id', orderId)
      .maybeSingle();

    if (error && isMissingSepayColumn(error)) {
      return res.status(500).json({ message: MIGRATION_HINT });
    }

    if (error || !order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn thanh toán.' });
    }

    if (order.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Không đủ quyền xem đơn này.' });
    }

    return res.json({
      courseId: order.course_id,
      ...toPaymentResponse(order)
    });
  } catch (err) {
    console.error('[GET /api/payments/:orderId/status]', err.message);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
});

/**
 * POST /api/payments/sepay/webhook
 * SePay gọi vào đây mỗi khi có biến động số dư. Tìm mã chuyển khoản trong nội
 * dung giao dịch → đủ tiền thì mở khóa đơn ngay.
 *
 * Luôn trả 200 { success: true } cho các ca không xử lý được (tiền lạ, sai mã):
 * SePay sẽ gọi lại tới 7 lần nếu không phải 2xx, mà gọi lại cũng không giúp gì.
 */
router.post('/sepay/webhook', async (req, res) => {
  if (!verifySepayApiKey(req.headers.authorization)) {
    return res.status(401).json({ success: false, message: 'API key không hợp lệ.' });
  }

  const payload = req.body || {};
  const sepayId = Number(payload.id);
  const transferAmount = Number(payload.transferAmount || 0);
  const transferCode =
    extractTransferCode(payload.code) ||
    extractTransferCode(payload.content) ||
    extractTransferCode(payload.description);

  // Tiền chuyển đi không liên quan tới đơn hàng.
  if (String(payload.transferType || 'in').toLowerCase() !== 'in') {
    return res.json({ success: true, skipped: 'transfer-out' });
  }

  if (!isSupabaseAdminReady()) {
    console.log('[SePay webhook] mock mode', { sepayId, transferCode, transferAmount });
    return res.json({ success: true, mode: 'mock' });
  }

  async function logTransaction({ orderId, matched, note }) {
    if (!Number.isFinite(sepayId)) {
      console.warn('[SePay webhook] payload thiếu id, bỏ qua nhật ký giao dịch.');
      return;
    }

    const { error } = await supabaseAdmin.from('sepay_transactions').insert({
      sepay_id: sepayId,
      order_id: orderId || null,
      transfer_code: transferCode || null,
      gateway: payload.gateway || null,
      account_number: payload.accountNumber || null,
      amount: transferAmount,
      content: payload.content || null,
      reference_code: payload.referenceCode || null,
      transaction_date: payload.transactionDate || null,
      matched,
      note: note || null,
      raw: payload
    });

    if (error) {
      console.warn('[SePay webhook] không ghi được nhật ký giao dịch:', error.message);
    }
  }

  try {
    if (Number.isFinite(sepayId)) {
      // SePay gửi lại cùng một giao dịch khi lần trước timeout — đừng xử lý hai lần.
      const { data: seen } = await supabaseAdmin
        .from('sepay_transactions')
        .select('id')
        .eq('sepay_id', sepayId)
        .maybeSingle();

      if (seen) {
        return res.json({ success: true, duplicated: true });
      }
    }

    if (!transferCode) {
      await logTransaction({ matched: false, note: 'Nội dung chuyển khoản không chứa mã đơn.' });
      return res.json({ success: true, matched: false });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, course_id, status, amount, transfer_code, paid_at')
      .eq('transfer_code', transferCode)
      .maybeSingle();

    if (orderError && isMissingSepayColumn(orderError)) {
      console.error('[SePay webhook]', MIGRATION_HINT);
      return res.status(500).json({ success: false, message: MIGRATION_HINT });
    }

    if (!order) {
      await logTransaction({ matched: false, note: `Không tìm thấy đơn cho mã ${transferCode}.` });
      return res.json({ success: true, matched: false });
    }

    if (order.status === 'paid') {
      await logTransaction({ orderId: order.id, matched: true, note: 'Đơn đã ở trạng thái paid.' });
      return res.json({ success: true, alreadyPaid: true });
    }

    const expectedAmount = Number(order.amount || 0);

    // Chuyển thiếu thì giữ nguyên đơn để kế toán xử lý tay; chuyển dư vẫn mở khóa.
    if (transferAmount < expectedAmount) {
      await logTransaction({
        orderId: order.id,
        matched: false,
        note: `Chuyển thiếu: nhận ${transferAmount}, cần ${expectedAmount}.`
      });
      return res.json({ success: true, matched: true, paid: false, reason: 'underpaid' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        sepay_ref: payload.referenceCode || String(sepayId || '')
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('[SePay webhook] cập nhật đơn thất bại:', updateError.message);
      return res.status(500).json({ success: false, message: 'Không cập nhật được đơn hàng.' });
    }

    await logTransaction({ orderId: order.id, matched: true, note: 'Đã mở khóa tự động.' });

    console.log(`[SePay webhook] ${transferCode} → mở khóa đơn ${order.id} (${transferAmount}đ)`);
    return res.json({ success: true, matched: true, paid: true });
  } catch (err) {
    console.error('[POST /api/payments/sepay/webhook]', err.message);
    return res.status(500).json({ success: false, message: 'Webhook error.' });
  }
});

/**
 * Mở/đóng khóa tay — lối thoát cho các ca SePay không tự khớp được (học viên
 * chuyển sai nội dung, chuyển thiếu, chuyển qua kênh khác).
 */
router.post('/:orderId/approve', requireAuth, requireRole('admin'), async (req, res) => {
  const { orderId } = req.params;

  if (!isSupabaseAdminReady()) {
    return res.json({
      orderId,
      status: 'paid',
      approvedAt: new Date().toISOString(),
      mode: 'mock'
    });
  }

  try {
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', orderId)
      .select('id, status, paid_at')
      .single();

    if (error) {
      if (isMissingSepayColumn(error)) {
        return res.status(500).json({ message: MIGRATION_HINT });
      }
      return res.status(500).json({ message: 'Không thể mở khóa đơn hàng.' });
    }

    return res.json({
      orderId: order.id,
      status: order.status,
      approvedAt: order.paid_at || new Date().toISOString()
    });
  } catch (err) {
    console.error('[POST /api/payments/:orderId/approve]', err.message);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
});

router.post('/:orderId/revoke', requireAuth, requireRole('admin'), async (req, res) => {
  const { orderId } = req.params;

  if (!isSupabaseAdminReady()) {
    return res.json({
      orderId,
      status: 'failed',
      revokedAt: new Date().toISOString(),
      mode: 'mock'
    });
  }

  try {
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .update({ status: 'failed' })
      .eq('id', orderId)
      .select('id, status')
      .single();

    if (error) {
      return res.status(500).json({ message: 'Không thể đóng khóa đơn hàng.' });
    }

    return res.json({
      orderId: order.id,
      status: order.status,
      revokedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('[POST /api/payments/:orderId/revoke]', err.message);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
});

export default router;
