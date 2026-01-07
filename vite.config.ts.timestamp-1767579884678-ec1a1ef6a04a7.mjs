// vite.config.ts
import { defineConfig } from "file:///home/lw/projects/app-8hmwu4kdi3nl/node_modules/vite/dist/node/index.js";
import { miaodaDevPlugin } from "file:///home/lw/projects/app-8hmwu4kdi3nl/node_modules/miaoda-sc-plugin/dist/index.js";
import react from "file:///home/lw/projects/app-8hmwu4kdi3nl/node_modules/@vitejs/plugin-react/dist/index.js";
import svgr from "file:///home/lw/projects/app-8hmwu4kdi3nl/node_modules/vite-plugin-svgr/dist/index.js";
import path from "path";
var __vite_injected_original_dirname = "/home/lw/projects/app-8hmwu4kdi3nl";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    miaodaDevPlugin(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent"
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  server: {
    port: 3002,
    // 修改为3002端口
    host: "0.0.0.0"
    // 允许外部访问
  },
  // 明确指定环境变量前缀以确保正确加载
  envPrefix: ["VITE_", "NODE_"],
  // 指定要加载的环境文件
  envDir: "."
  // 在项目根目录查找环境文件
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9sdy9wcm9qZWN0cy9hcHAtOGhtd3U0a2RpM25sXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9sdy9wcm9qZWN0cy9hcHAtOGhtd3U0a2RpM25sL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL2x3L3Byb2plY3RzL2FwcC04aG13dTRrZGkzbmwvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHsgbWlhb2RhRGV2UGx1Z2luIH0gZnJvbSBcIm1pYW9kYS1zYy1wbHVnaW5cIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjtcbmltcG9ydCBzdmdyIGZyb20gXCJ2aXRlLXBsdWdpbi1zdmdyXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuXG4vLyBodHRwczovL3ZpdGUuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIG1pYW9kYURldlBsdWdpbigpLFxuICAgIHN2Z3Ioe1xuICAgICAgc3Znck9wdGlvbnM6IHtcbiAgICAgICAgaWNvbjogdHJ1ZSxcbiAgICAgICAgZXhwb3J0VHlwZTogXCJuYW1lZFwiLFxuICAgICAgICBuYW1lZEV4cG9ydDogXCJSZWFjdENvbXBvbmVudFwiLFxuICAgICAgfSxcbiAgICB9KSxcbiAgXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcbiAgICB9LFxuICB9LFxuICBzZXJ2ZXI6IHtcbiAgICBwb3J0OiAzMDAyLCAgLy8gXHU0RkVFXHU2NTM5XHU0RTNBMzAwMlx1N0FFRlx1NTNFM1xuICAgIGhvc3Q6ICcwLjAuMC4wJyAgLy8gXHU1MTQxXHU4QkI4XHU1OTE2XHU5MEU4XHU4QkJGXHU5NUVFXG4gIH0sXG4gIC8vIFx1NjYwRVx1Nzg2RVx1NjMwN1x1NUI5QVx1NzNBRlx1NTg4M1x1NTNEOFx1OTFDRlx1NTI0RFx1N0YwMFx1NEVFNVx1Nzg2RVx1NEZERFx1NkI2M1x1Nzg2RVx1NTJBMFx1OEY3RFxuICBlbnZQcmVmaXg6IFsnVklURV8nLCAnTk9ERV8nXSxcbiAgLy8gXHU2MzA3XHU1QjlBXHU4OTgxXHU1MkEwXHU4RjdEXHU3Njg0XHU3M0FGXHU1ODgzXHU2NTg3XHU0RUY2XG4gIGVudkRpcjogJy4nLCAgLy8gXHU1NzI4XHU5ODc5XHU3NkVFXHU2ODM5XHU3NkVFXHU1RjU1XHU2N0U1XHU2MjdFXHU3M0FGXHU1ODgzXHU2NTg3XHU0RUY2XG59KTsiXSwKICAibWFwcGluZ3MiOiAiO0FBQXdSLFNBQVMsb0JBQW9CO0FBQ3JULFNBQVMsdUJBQXVCO0FBQ2hDLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsT0FBTyxVQUFVO0FBSmpCLElBQU0sbUNBQW1DO0FBT3pDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLGdCQUFnQjtBQUFBLElBQ2hCLEtBQUs7QUFBQSxNQUNILGFBQWE7QUFBQSxRQUNYLE1BQU07QUFBQSxRQUNOLFlBQVk7QUFBQSxRQUNaLGFBQWE7QUFBQSxNQUNmO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLElBQ3RDO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBO0FBQUEsSUFDTixNQUFNO0FBQUE7QUFBQSxFQUNSO0FBQUE7QUFBQSxFQUVBLFdBQVcsQ0FBQyxTQUFTLE9BQU87QUFBQTtBQUFBLEVBRTVCLFFBQVE7QUFBQTtBQUNWLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
