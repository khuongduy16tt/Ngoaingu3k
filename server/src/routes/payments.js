import { Router } from 'express';
import { supabaseAdmin, isSupabaseAdminReady } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

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
    const { courseId, amount, provider = 'demo-checkout' } = req.body;
    const userId = req.user.id;

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
          status: provider === 'demo-checkout' ? 'paid' : 'pending',
          amount: Number(amount),
        })
        .select('id, status')
        .single();

      if (error) {
        return res.status(500).json({ message: 'Không thể tạo đơn hàng.' });
      }

      // TODO: For real payment providers, return paymentUrl and handle webhook
      return res.json({
        message: provider === 'demo-checkout'
          ? 'Đăng ký khóa học thành công.'
          : 'Đơn hàng đã được tạo, chờ thanh toán.',
        orderId: order.id,
        status: order.status,
        paymentUrl: provider !== 'demo-checkout'
          ? 'https://payment-gateway.example/checkout'
          : null,
        mode: 'supabase',
      });
    } catch (err) {
      console.error('[POST /api/payments/checkout]', err.message);
      return res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
  }
);

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
