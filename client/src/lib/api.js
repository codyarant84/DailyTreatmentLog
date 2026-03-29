import axios from 'axios';
import { supabase } from './supabase.js';

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

const api = {
  async get(url) {
    return axios.get(url, { headers: await authHeaders() });
  },
  async post(url, data) {
    return axios.post(url, data, { headers: await authHeaders() });
  },
  async put(url, data) {
    return axios.put(url, data, { headers: await authHeaders() });
  },
  async delete(url) {
    return axios.delete(url, { headers: await authHeaders() });
  },
};

export default api;
