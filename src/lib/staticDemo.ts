/// <reference types="vite/client" />

export const isStaticDemo = () => import.meta.env.VITE_STATIC_DEMO === 'true';
