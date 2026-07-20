import { Router } from 'express';
import { validate } from '../middleware/validate.js';

const router = Router();

const PHONE_PATTERN = /^[0-9+\s-]{8,15}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/leads/consultation
 * Public homepage lead form. Forwards to a Google Sheets Apps Script
 * webhook when configured; otherwise logs and degrades to a mock response
 * (see server/.env.example and README "Consultation form" section).
 */
router.post('/consultation', validate(['fullName', 'phone', 'program']), async (req, res) => {
  const fullName = String(req.body.fullName).trim();
  const phone = String(req.body.phone).trim();
  const program = String(req.body.program).trim();
  const email = req.body.email ? String(req.body.email).trim() : '';
  const needs = req.body.needs ? String(req.body.needs).trim() : '';

  if (!PHONE_PATTERN.test(phone)) {
    return res.status(400).json({ message: 'Số điện thoại không hợp lệ.' });
  }

  if (email && !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ message: 'Email không hợp lệ.' });
  }

  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const lead = {
    fullName,
    phone,
    email,
    program,
    needs,
    source: 'homepage-hero',
    submittedAt: new Date().toISOString(),
  };

  if (!webhookUrl) {
    console.log('[Lead] (mock mode, GOOGLE_SHEETS_WEBHOOK_URL chưa cấu hình)', lead);
    return res.json({
      message: 'Đã ghi nhận đăng ký tư vấn (chế độ demo).',
      mode: 'mock',
    });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    });

    if (!response.ok) {
      throw new Error(`Webhook responded with ${response.status}`);
    }

    return res.json({ message: 'Đăng ký tư vấn thành công, chúng tôi sẽ liên hệ sớm.', mode: 'sheet' });
  } catch (err) {
    console.error('[POST /api/leads/consultation]', err.message);
    return res.status(502).json({ message: 'Không thể gửi thông tin lúc này, vui lòng thử lại sau.' });
  }
});

export default router;
