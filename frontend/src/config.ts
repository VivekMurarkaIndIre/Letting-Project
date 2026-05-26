/// <reference types="vite/client" />
const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
export default API_URL;
