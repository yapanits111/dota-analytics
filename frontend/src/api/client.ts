import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000"
});

export const searchPlayer   = (q: string) =>
  api.get("/search", { params: { q } }).then(r => r.data);

export const syncPlayer     = (id: number) =>
  api.post(`/sync/${id}`).then(r => r.data);

export const getProviders   = () =>
  api.get("/chat/providers").then(r => r.data);

export const getOverview    = (id: number) =>
  api.get(`/stats/overview/${id}`).then(r => r.data[0]);

export const getHeroStats   = (id: number) =>
  api.get(`/stats/heroes/${id}`).then(r => r.data);

export const getDuration    = (id: number) =>
  api.get(`/stats/duration/${id}`).then(r => r.data);

export const getAttributes  = (id: number) =>
  api.get(`/stats/attributes/${id}`).then(r => r.data);

export const getRoles       = (id: number) =>
  api.get(`/stats/roles/${id}`).then(r => r.data);

export const getAccountProfile = (id: number) =>
  api.get(`/search/account/${id}`).then(r => r.data);

export const getRecent      = (id: number) =>
  api.get(`/stats/recent/${id}`).then(r => r.data);

export const getTip         = (id: number, provider: string) =>
  api.get(`/stats/tip/${id}`, { params: { provider } }).then(r => r.data);

export const getSuggestions = (id: number, provider: string) =>
  api.get(`/chat/suggestions/${id}`, { params: { provider } }).then(r => r.data);

export const chatQuery      = (
  question: string,
  accountId: number,
  provider: string,
  history: { role: string; content: string }[] = []
) =>
  api.post("/chat/query", { question, account_id: accountId, provider, history })
     .then(r => r.data);
