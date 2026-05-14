import axios from 'axios';

const TOKEN_KEY = 'fieldside_token';
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function mergeHeaders(opts = {}) {
  return { ...authHeaders(), ...(opts.headers ?? {}) };
}

const api = {
  async get(url, opts = {}) {
    return axios.get(`${BASE_URL}${url}`, { headers: mergeHeaders(opts) });
  },
  async post(url, data, opts = {}) {
    return axios.post(`${BASE_URL}${url}`, data, { headers: mergeHeaders(opts) });
  },
  async put(url, data, opts = {}) {
    return axios.put(`${BASE_URL}${url}`, data, { headers: mergeHeaders(opts) });
  },
  async patch(url, data, opts = {}) {
    return axios.patch(`${BASE_URL}${url}`, data, { headers: mergeHeaders(opts) });
  },
  async delete(url, opts = {}) {
    return axios.delete(`${BASE_URL}${url}`, { headers: mergeHeaders(opts) });
  },
};

export default api;
