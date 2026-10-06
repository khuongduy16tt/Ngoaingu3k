import { randomUUID } from 'node:crypto';
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
import { quoteComboPurchase, quoteCoursePurchase } from '../lib/comboPricing.js';

const router = Router();

const MIGRATION_HINT =
  'Thiếu cột transfer_code/paid_at trên bảng orders. Chạy supabase/sepay-payment-migration.sql trong Supabase SQL editor.';

const COMBO_MIGRATION_HINT =
  'Chưa có bảng combo. Chạy supabase/course-combo-migration.sql trong Supabase SQL editor.';

function isMissingComboSchema(error) {
  if (!error) return false;
  const code = error.code || '';
  const message = `${error.message || ''} ${error.details || ''}`;
  return (
    ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(code) ||
    /course_combo|combo_id|combo_group/.test(message)
  );
}

async function loadOrderGroup(order) {
  if (!order?.combo_group) {
    return [order];
  }

  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('combo_group', order.combo_group);

  return error || !data?.length ? [order] : data;
}

function ownershipFromOrders(orders) {
  const owned = new Map();
  (orders || [])
    .filter((order) => order.status === 'paid' && order.course_id)
    .forEach((order) => {
      if (order.with_tutoring) owned.set(order.course_id, 'tutoring');
      else if (!owned.has(order.course_id)) owned.set(order.course_id, 'course');
    });
  return owned;
}

function wantsTutoring(body) {
  return body?.withTutoring === true || body?.withTutoring === 'true';
}

function comboExtra(group) {
  if (!group[0]?.combo_group) return {};
  return {
    comboId: group[0].combo_id || null,
    courseIds: group.map((row) => row.course_id).filter(Boolean),
    amount: group.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  };
}

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
  const amount = Number(extra.amount ?? order.amount ?? 0);

  return {
    orderId: order.id,
    amount,
    status: order.status,
    paidAt: order.paid_at || null,
    withTutoring: Boolean(order.with_tutoring),
    ...buildPaymentTarget({ amount, transferCode: order.transfer_code }),
    ...extra
  };
}

function getPgExtra(req, order, courseId, amount = order?.amount) {
  if (!isSepayPgReady() || !order || order.status === 'paid') return {};
  
  const sepayPgClient = getSepayPgClient();
  if (!sepayPgClient) return {};
  
  const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
  const returnUrl = courseId ? `${origin}/courses/${courseId}` : `${origin}/courses`;
  const checkoutURL = sepayPgClient.checkout.initCheckoutUrl();
  const checkoutFormfields = sepayPgClient.checkout.initOneTimePaymentFields({
    payment_method: 'BANK_TRANSFER',
    order_invoice_number: String(order.id),
    order_amount: Number(amount || 0),
    currency: 'VND',
    order_description: order.transfer_code || String(order.id),
    success_url: `${returnUrl}?payment=success`,
    error_url: `${returnUrl}?payment=error`,
    cancel_url: `${returnUrl}?payment=cancel`,
  });
  
  return { checkoutURL, checkoutFormfields };
}

/**
 * Đơn mới cần một mã chuyển khoản chưa ai dùng. Mã bốc ngẫu nhiên nên vẫn có
 * xác suất đụng nhau — gặp lỗi unique thì bốc lại.
 */
async function createOrderWithTransferCode({ userId, courseId, amount, extra = {} }) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: userId,
        course_id: courseId,
        provider: 'sepay',
        status: 'pending',
        amount,
        transfer_code: makeTransferCode(),
        ...extra
      })
      // '*' thay vì liệt kê cột: chưa chạy migration combo thì mua lẻ vẫn chạy.
      .select('*')
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
  const withTutoring = wantsTutoring(req.body);

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
      // '*': tutoring_price chỉ có sau migration dạy kèm.
      .select('*')
      .eq('id', courseId)
      .maybeSingle();

    if (courseError || !course || course.status !== 'published') {
      return res.status(404).json({ message: 'Khóa học không khả dụng để thanh toán.' });
    }

    if (withTutoring && !Number(course.tutoring_price)) {
      return res.status(400).json({ message: 'Khóa học này chưa mở bán gói dạy kèm.' });
    }

    const { data: openOrders, error: openOrderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .in('status', ['paid', 'pending'])
      .order('created_at', { ascending: false });

    if (openOrderError && isMissingSepayColumn(openOrderError)) {
      return res.status(500).json({ message: MIGRATION_HINT });
    }

    // Giá lấy từ DB, không tin số tiền client gửi lên. Đã có khóa mà mua thêm
    // dạy kèm thì chỉ trả phần chênh.
    const quote = quoteCoursePurchase({
      price: course.price,
      tutoringPrice: course.tutoring_price,
      owned: ownershipFromOrders(openOrders).get(courseId),
      withTutoring
    });

    if (quote.alreadyOwned) {
      const paidOrder = (openOrders || []).find((order) => order.status === 'paid');
      return res.json({
        message: withTutoring ? 'Bạn đã có gói dạy kèm của khóa này.' : 'Bạn đã mua khóa học này.',
        mode: 'existing',
        ...toPaymentResponse(paidOrder)
      });
    }

    // Học viên bấm mua lại khi chưa chuyển tiền: dùng lại đúng mã cũ, nếu không
    // mã trên QR sẽ khác mã họ đang định chuyển.
    // Đơn combo đang chờ thì không dùng lại cho mua lẻ: mã của nó gắn với cả nhóm.
    const pendingOrder = (openOrders || []).find(
      (order) =>
        order.status === 'pending' &&
        order.transfer_code &&
        !order.combo_group &&
        Boolean(order.with_tutoring) === withTutoring
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
      amount: quote.amount,
      // Chỉ gửi with_tutoring khi cần: chưa chạy migration dạy kèm thì mua thường vẫn chạy.
      extra: withTutoring ? { with_tutoring: true } : {}
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
 * POST /api/payments/checkout-combo
 * Mua combo: tạo một đơn cho mỗi khóa còn thiếu trong combo, chung combo_group.
 * Đơn đầu nhóm mang mã chuyển khoản; tiền về là cả nhóm được mở. Giá lấy từ DB,
 * học viên đã có sẵn khóa nào thì trừ đúng phần giá combo của khóa đó.
 */
router.post('/checkout-combo', requireAuth, validate(['comboId']), async (req, res) => {
  const { comboId } = req.body;
  const userId = req.user.id;
  const withTutoring = wantsTutoring(req.body);

  if (!isSupabaseAdminReady()) {
    return res.json({
      message: 'Đơn combo mock (chưa cấu hình Supabase).',
      orderId: `mock-order-${Date.now()}`,
      amount: Number(req.body.amount || 0),
      status: 'pending',
      mode: 'mock',
      comboId,
      ...buildPaymentTarget({ amount: req.body.amount, transferCode: makeTransferCode() })
    });
  }

  try {
    const { data: combo, error: comboError } = await supabaseAdmin
      .from('course_combos')
      .select('*, course_combo_items(course_id, position, courses(*))')
      .eq('id', comboId)
      .maybeSingle();

    if (comboError && isMissingComboSchema(comboError)) {
      return res.status(500).json({ message: COMBO_MIGRATION_HINT });
    }

    // Khóa con bị ẩn/xóa thì không bán kèm nữa — combo còn lại bao nhiêu khóa
    // công khai thì bán bấy nhiêu, giá chia theo đúng các khóa đó.
    const courses = (combo?.course_combo_items || [])
      .filter((item) => item.courses?.status === 'published')
      .sort((left, right) => Number(left.position || 0) - Number(right.position || 0))
      .map((item) => ({
        id: item.courses.id,
        price: Number(item.courses.price || 0),
        tutoringPrice: Number(item.courses.tutoring_price || 0)
      }));

    if (comboError || !combo || combo.status !== 'published' || courses.length < 2) {
      return res.status(404).json({ message: 'Combo không khả dụng để thanh toán.' });
    }

    if (withTutoring && !Number(combo.tutoring_price)) {
      return res.status(400).json({ message: 'Combo này chưa mở bán gói dạy kèm.' });
    }

    const courseIds = courses.map((course) => course.id);
    const { data: userOrders, error: userOrdersError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .in('course_id', courseIds)
      .in('status', ['paid', 'pending']);

    if (userOrdersError) {
      if (isMissingSepayColumn(userOrdersError)) {
        return res.status(500).json({ message: MIGRATION_HINT });
      }
      console.error('[POST /api/payments/checkout-combo]', userOrdersError.message);
      return res.status(500).json({ message: 'Không thể tạo đơn hàng.' });
    }

    const { amount, lines } = quoteComboPurchase({
      comboPrice: combo.price,
      comboTutoringPrice: combo.tutoring_price,
      courses,
      owned: ownershipFromOrders(userOrders),
      withTutoring
    });

    if (!lines.length) {
      return res.json({
        message: withTutoring
          ? 'Bạn đã có gói dạy kèm cho toàn bộ khóa trong combo.'
          : 'Bạn đã sở hữu toàn bộ khóa trong combo.',
        mode: 'existing',
        orderId: null,
        status: 'paid',
        amount: 0,
        comboId,
        courseIds
      });
    }

    // Bấm mua lại khi chưa chuyển tiền: dùng lại nhóm cũ để mã trên QR không đổi.
    const pendingLead = (userOrders || []).find(
      (order) =>
        order.status === 'pending' &&
        order.combo_id === comboId &&
        order.combo_group &&
        order.transfer_code &&
        Boolean(order.with_tutoring) === withTutoring
    );
    if (pendingLead) {
      const group = await loadOrderGroup(pendingLead);
      const extra = comboExtra(group.filter((row) => row.status === 'pending'));
      return res.json({
        message: 'Đơn combo đang chờ chuyển khoản.',
        mode: 'reused',
        ...toPaymentResponse(pendingLead, { ...extra, ...getPgExtra(req, pendingLead, '', extra.amount) })
      });
    }

    const comboGroup = randomUUID();
    const tutoringField = withTutoring ? { with_tutoring: true } : {};
    const [leadLine, ...otherLines] = lines;
    const { order: leadOrder, error: leadError } = await createOrderWithTransferCode({
      userId,
      courseId: leadLine.id,
      amount: leadLine.amount,
      extra: { combo_id: comboId, combo_group: comboGroup, ...tutoringField }
    });

    if (leadError) {
      if (isMissingComboSchema(leadError)) {
        return res.status(500).json({ message: COMBO_MIGRATION_HINT });
      }
      if (isMissingSepayColumn(leadError)) {
        return res.status(500).json({ message: MIGRATION_HINT });
      }
      console.error('[POST /api/payments/checkout-combo]', leadError.message);
      return res.status(500).json({ message: 'Không thể tạo đơn hàng.' });
    }

    if (otherLines.length) {
      const { error: restError } = await supabaseAdmin.from('orders').insert(
        otherLines.map((line) => ({
          user_id: userId,
          course_id: line.id,
          provider: 'sepay',
          status: 'pending',
          amount: line.amount,
          combo_id: comboId,
          combo_group: comboGroup,
          ...tutoringField
        }))
      );

      if (restError) {
        // Nhóm thiếu khóa thì tiền về sẽ mở thiếu — hủy cả nhóm cho học viên bấm lại.
        await supabaseAdmin.from('orders').delete().eq('combo_group', comboGroup);
        console.error('[POST /api/payments/checkout-combo]', restError.message);
        return res.status(500).json({ message: 'Không thể tạo đơn hàng.' });
      }
    }

    return res.json({
      message: 'Đơn combo đã được tạo, chờ chuyển khoản.',
      mode: 'supabase',
      sepayReady: isSepayReady(),
      ...toPaymentResponse(leadOrder, {
        comboId,
        courseIds: lines.map((line) => line.id),
        withTutoring,
        amount,
        ...getPgExtra(req, leadOrder, '', amount)
      })
    });
  } catch (err) {
    console.error('[POST /api/payments/checkout-combo]', err.message);
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
      .select('*')
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
      ...toPaymentResponse(order, comboExtra(await loadOrderGroup(order)))
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
      .select('*')
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

    // Đơn combo: mã nằm ở đơn đầu nhóm nhưng số tiền là của cả nhóm.
    const isCombo = Boolean(order.combo_group);
    const expectedAmount = isCombo
      ? comboExtra(await loadOrderGroup(order)).amount
      : Number(order.amount || 0);

    // Chuyển thiếu thì giữ nguyên đơn để kế toán xử lý tay; chuyển dư vẫn mở khóa.
    if (transferAmount < expectedAmount) {
      await logTransaction({
        orderId: order.id,
        matched: false,
        note: `Chuyển thiếu: nhận ${transferAmount}, cần ${expectedAmount}.`
      });
      return res.json({ success: true, matched: true, paid: false, reason: 'underpaid' });
    }

    const paidUpdate = supabaseAdmin
      .from('orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        sepay_ref: payload.referenceCode || String(sepayId || '')
      });
    const { error: updateError } = isCombo
      ? await paidUpdate.eq('combo_group', order.combo_group)
      : await paidUpdate.eq('id', order.id);

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
 * Cập nhật một đơn; đơn thuộc combo thì cập nhật cả nhóm — mở một khóa của combo
 * mà bỏ sót các khóa còn lại là học viên trả tiền combo nhưng chỉ học được một.
 */
async function updateOrderOrGroup(orderId, changes) {
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  if (error || !order) {
    return { data: null, error: error || { message: 'Không tìm thấy đơn.' } };
  }

  const update = supabaseAdmin.from('orders').update(changes);
  const scoped = order.combo_group
    ? update.eq('combo_group', order.combo_group)
    : update.eq('id', orderId);

  return scoped.select('*');
}

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
    const { data: rows, error } = await updateOrderOrGroup(orderId, {
      status: 'paid',
      paid_at: new Date().toISOString()
    });
    const order = rows?.find((row) => row.id === orderId) || rows?.[0];

    if (error || !order) {
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
    const { data: rows, error } = await updateOrderOrGroup(orderId, { status: 'failed' });
    const order = rows?.find((row) => row.id === orderId) || rows?.[0];

    if (error || !order) {
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
