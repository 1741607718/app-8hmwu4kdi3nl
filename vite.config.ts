import { defineConfig } from "vite";
import { miaodaDevPlugin } from "miaoda-sc-plugin";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3007,  // 修改为3007端口
    host: '0.0.0.0',  // 允许外部访问
    strictPort: true,
    allowedHosts: ['fsif.wzbc.edu.cn', 'localhost', '127.0.0.1'],
    proxy: {
      '/api/auth': {
        target: 'http://127.0.0.1:3020',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://127.0.0.1:3021',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Vite Proxy Error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Vite Proxy -> Sending Request to Target:', req.method, req.url, 'Headers:', req.headers);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Vite Proxy <- Received Response from Target:', proxyRes.statusCode, req.url, 'Headers:', proxyRes.headers);
          });
        },
      }
    }
  },
  preview: {
    port: 3002,
    host: '0.0.0.0',
    proxy: {
      '/api/auth': {
        target: 'http://127.0.0.1:3020',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://127.0.0.1:3021',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  // 明确指定环境变量前缀以确保正确加载
  envPrefix: ['VITE_', 'NODE_'],
  // 指定要加载的环境文件
  envDir: '.',  // 在项目根目录查找环境文件
});