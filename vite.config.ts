import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "robots.txt", "apple-touch-icon.png"],
        manifest: {
          name: "BoulangeriePro ERP",
          short_name: "BoulangeriePro",
          description:
            "ERP & Caisse pour boulangerie artisanale en Côte d'Ivoire",
          theme_color: "#d97706", // Amber-500 (couleur principale de l'app)
          background_color: "#1c1917", // Stone-950
          display: "standalone",
          icons: [
            {
              src: "/pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
          ],
        },
        workbox: {
          // Stratégie offline : cache des assets statiques, network-first pour l'API
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com/,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "google-fonts-stylesheets",
              },
            },
            {
              // Cache les assets statiques (JS, CSS, images)
              urlPattern: /\.(js|css|png|jpg|jpeg|svg|ico)$/,
              handler: "CacheFirst",
              options: {
                cacheName: "static-assets",
                expiration: {
                  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 jours
                },
              },
            },
            {
              // Pour les appels API : network first, fallback sur cache si offline
              urlPattern: /^https?:\/\/.*\/api\//,
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                networkTimeoutSeconds: 10,
                expiration: {
                  maxAgeSeconds: 24 * 60 * 60, // 1 jour
                },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "."),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== "true",
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === "true" ? null : {},
      // Proxy vers l'API backend en développement : le front appelle /api/...
      // et Vite redirige vers le serveur Express (PORT=4000).
      proxy: {
        "/api": {
          target: process.env.API_PROXY_TARGET || "http://localhost:4000",
          changeOrigin: true,
        },
      },
    },
  };
});
