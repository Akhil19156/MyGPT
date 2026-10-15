import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "localhost",
    port: 5173,
    proxy: {
      "/conversations": "http://localhost:8080",
      "/history": "http://localhost:8080",
      "/upload": "http://localhost:8080",
      "/chat": "http://localhost:8080"
    }
  }
});
