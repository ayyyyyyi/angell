import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite 配置：告诉打包工具「这个项目用 React 写」
export default defineConfig({
  plugins: [react()],
});
