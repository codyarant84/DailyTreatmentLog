import axios from 'axios';

const TOKEN_KEY = 'fieldside_token';
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const api = {
  async get(url) {
    return axios.get(`${BASE_URL}${url}`, { headers: authHeaders() });
  },
  async post(url, data) {
    return axios.post(`${BASE_URL}${url}`, data, { headers: authHeaders() });
  },
  async put(url, data) {
    return axios.put(`${BASE_URL}${url}`, data, { headers: authHeaders() });
  },
  async patch(url, data) {
    return axios.patch(`${BASE_URL}${url}`, data, { headers: authHeaders() });
  },
  async delete(url) {
    return axios.delete(`${BASE_URL}${url}`, { headers: authHeaders() });
  },
};

export default api;
