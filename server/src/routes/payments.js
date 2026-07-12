import { Router } from 'express';
import { supabaseAdmin, isSupabaseAdminReady } from '../config/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

function makeTransferCode(orderId) {
  return `NN3K-${String(orderId || Date.now()).slice(-8).toUpperCase()}`;
}

async function notifyAdminPayment({ orderId, user, course, amount }) {
  const adminEmail = process.env.ADMIN_PAYMENT_EMAIL || process.env.ADMIN_EMAIL;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!adminEmail || !resendApiKey) {
    return false;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.PAYMENT_EMAIL_FROM || 'Ngoaingu3k <onboarding@resend.dev>',
      to: adminEmail,
      subject: `Học viên đã xác nhận chuyển khoản ${makeTransferCode(orderId)}`,
      html: `
        <h2>Yêu cầu mở khóa khóa học</h2>
        <p>Học viên: ${user.email || user.id}</p>
        <p>Khóa học: ${course?.title || course?.id || ''}</p>
        <p>Số tiền: ${Number(amount || 0).toLocaleString('vi-VN')} đ</p>
        <p>Nội dung chuyển khoản: ${makeTransferCode(orderId)}</p>
        <p>Vui lòng kiểm tra với kế toán rồi mở khóa trong dashboard admin.</p>
      `
    })
  });

  return response.ok;
}

/**
 * POST /api/payments/checkout
 * Creates a payment order and records it in the database.
 * In production: integrate with Stripe / VNPay / MoMo here.
 */
router.post(
  '/checkout',
  requireAuth,
  validate(['courseId', 'amount']),
  async (req, res) => {
    const { courseId, amount, provider = 'manual-bank-transfer' } = req.body;
    const userId = req.user.id;
    const submittedAmount = Number(amount);

    if (!Number.isFinite(submittedAmount) || submittedAmount < 0) {
      return res.status(400).json({ message: 'Số tiền thanh toán không hợp lệ.' });
    }

    const configuredProvider = process.env.PAYMENT_PROVIDER || 'demo-checkout';
    const isDemoCheckout = provider === 'demo-checkout';
    const demoCheckoutAllowed =
      configuredProvider === 'demo-checkout' || process.env.NODE_ENV !== 'production';

    if (isDemoCheckout && !demoCheckoutAllowed) {
      return res.status(400).json({
        message: 'Demo checkout đã bị tắt trong môi trường hiện tại.'
      });
    }

    if (!isSupabaseAdminReady()) {
      // Scaffolded mock response
      return res.json({
        message: 'Thanh toán thành công (mock mode).',
        orderId: `mock-order-${Date.now()}`,
        provider,
        paymentUrl: 'https://payment-gateway.example/checkout',
        mode: 'mock',
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

      const trustedAmount = Number(course.price || 0);

      // Check if already purchased
      const { data: existing } = await supabaseAdmin
        .from('orders')
        .select('id, status')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .eq('status', 'paid')
        .limit(1);

      if (existing?.length) {
        return res.json({
          message: 'Bạn đã mua khóa học này.',
          orderId: existing[0].id,
          mode: 'existing',
        });
      }

      // Create order record
      const { data: order, error } = await supabaseAdmin
        .from('orders')
        .insert({
          user_id: userId,
          course_id: courseId,
          provider,
          status: 'pending',
          amount: trustedAmount,
        })
        .select('id, status, amount')
        .single();

      if (error) {
        return res.status(500).json({ message: 'Không thể tạo đơn hàng.' });
      }

      return res.json({
        message: 'Đơn hàng đã được tạo, chờ học viên chuyển khoản.',
        orderId: order.id,
        amount: order.amount,
        status: order.status,
        paymentUrl: null,
        transferCode: makeTransferCode(order.id),
        mode: 'supabase',
      });
    } catch (err) {
      console.error('[POST /api/payments/checkout]', err.message);
      return res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
  }
);

router.post('/confirm-transfer', requireAuth, validate(['orderId']), async (req, res) => {
  const { orderId } = req.body;
  const userId = req.user.id;

  if (!isSupabaseAdminReady()) {
    return res.json({
      orderId,
      status: 'awaiting_admin',
      adminEmailSent: false,
      mode: 'mock'
    });
  }

  try {
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, course_id, amount, status')
      .eq('id', orderId)
      .eq('user_id', userId)
      .maybeSingle();

    if (orderError || !order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn thanh toán.' });
    }

    if (order.status === 'paid') {
      return res.json({ orderId, status: 'paid', adminEmailSent: false });
    }

    const { data: course } = await supabaseAdmin
      .from('courses')
      .select('id, title')
      .eq('id', order.course_id)
      .maybeSingle();

    const emailSent = await notifyAdminPayment({
      orderId,
      user: req.user,
      course,
      amount: order.amount
    }).catch((err) => {
      console.warn('[Payment email]', err.message);
      return false;
    });

    return res.json({
      orderId,
      status: 'awaiting_admin',
      adminEmailSent: emailSent
    });
  } catch (err) {
    console.error('[POST /api/payments/confirm-transfer]', err.message);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
});

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
      .update({ status: 'paid' })
      .eq('id', orderId)
      .select('id, status')
      .single();

    if (error) {
      return res.status(500).json({ message: 'Không thể mở khóa đơn hàng.' });
    }

    return res.json({
      orderId: order.id,
      status: order.status,
      approvedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('[POST /api/payments/:orderId/approve]', err.message);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
});

/**
 * POST /api/payments/webhook
 * Webhook endpoint for payment providers to confirm payments.
 * Placeholder — implement provider-specific signature verification.
 */
router.post('/webhook', async (req, res) => {
  const { orderId, status, provider } = req.body;

  // TODO: Verify webhook signature from provider (Stripe / VNPay / MoMo)
  console.log(`[Webhook] ${provider} → orderId=${orderId}, status=${status}`);

  if (!isSupabaseAdminReady() || !orderId) {
    return res.json({ received: true });
  }

  try {
    if (status === 'paid' || status === 'success') {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', orderId);
    } else if (status === 'failed' || status === 'cancelled') {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'failed' })
        .eq('id', orderId);
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('[Webhook]', err.message);
    return res.status(500).json({ message: 'Webhook error.' });
  }
});

export default router;
