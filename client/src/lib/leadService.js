import { apiFetch } from './api';

export function submitConsultationRequest({ fullName, phone, email, program, needs }) {
  return apiFetch('/api/leads/consultation', {
    method: 'POST',
    body: { fullName, phone, email, program, needs },
  });
}
