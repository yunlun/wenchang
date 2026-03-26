import axios from 'axios';

// 浏览器端走 Next.js 反向代理（/api/proxy → localhost:4000/api），避免跨域
// 服务端渲染时直连后端
const API_BASE =
  typeof window !== 'undefined'
    ? '/api/proxy/v1'
    : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1`;

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// 自动附加 JWT
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('wc_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 统一处理 401（登录/注册接口本身除外，避免在登录页反复刷新）
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const requestUrl = String(error?.config?.url || '');
    const isAuthRequest =
      requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');

    if (error.response?.status === 401 && typeof window !== 'undefined' && !isAuthRequest) {
      localStorage.removeItem('wc_token');
      if (window.location.pathname !== '/auth/login') {
        window.location.href = '/auth/login';
      }
    }

    return Promise.reject(error);
  }
);

// ── Auth API ──────────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; password: string; name: string; studioName?: string }) =>
    apiClient.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    apiClient.post('/auth/login', data),
  me: () => apiClient.get('/auth/me'),
};

// ── Artwork API ───────────────────────────────────────────────
export const artworkApi = {
  list: (page = 1, pageSize = 20) =>
    apiClient.get('/artworks', { params: { page, pageSize } }),
  get: (id: string) => apiClient.get(`/artworks/${id}`),
  upload: (formData: FormData) =>
    apiClient.post('/artworks', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// ── Certificate API ───────────────────────────────────────────
export const certificateApi = {
  list: () => apiClient.get('/certificates'),
  get: (id: string) => apiClient.get(`/certificates/${id}`),
  download: (id: string) =>
    apiClient.get(`/certificates/${id}/download`, { responseType: 'blob' }),
  verify: (certNo: string) =>
    apiClient.get(`/certificates/verify/${certNo}`),
};

