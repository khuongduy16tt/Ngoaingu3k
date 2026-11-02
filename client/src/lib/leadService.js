import { apiFetch } from './api';

export function submitConsultationRequest({ fullName, phone, email, program, needs, source }) {
  return apiFetch('/api/leads/consultation', {
    method: 'POST',
    body: { fullName, phone, email, program, needs, source },
  });
}
