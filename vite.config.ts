import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createAiMiddleware } from './server/aiServer';

function localAiPlugin(apiKey: string | undefined, model: string | undefined): Plugin {
  return {
    name: 'goodcall-local-ai',
    configureServer(server) {
      const ai = createAiMiddleware({ apiKey, model });
      server.middlewares.use(ai.middleware);
      server.httpServer?.once('close', ai.dispose);
    },
    configurePreviewServer(server) {
      const ai = createAiMiddleware({ apiKey, model });
      server.middlewares.use(ai.middleware);
      server.httpServer.once('close', ai.dispose);
    },
  };
}

export default defineConfig(({ mode }) => {
  // These values stay in the Node process. Never define a VITE_ API key.
  const env = loadEnv(mode, process.cwd(), 'OPENAI_');
  return {
    plugins: [react(), localAiPlugin(env.OPENAI_API_KEY, env.OPENAI_MODEL)],
    server: { host: '127.0.0.1', allowedHosts: ['localhost', '127.0.0.1'], cors: false },
    preview: { host: '127.0.0.1', allowedHosts: ['localhost', '127.0.0.1'], cors: false },
  };
});
