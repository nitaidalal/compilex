import { getHealth } from '../services/health.service.js';

export async function health(req, res) {
  res.status(200).json({ success: true, data: getHealth() });
}
