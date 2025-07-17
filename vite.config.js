import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vitejs.dev/config/
export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  return defineConfig({
    // appType: "mpa",x
    plugins: [
      vue(),
      // vueDevTools(),
    ],
    base: env.VITE_BASE_URL || "/",
    optimizeDeps: {
      exclude: [
        "midifile-performer",
      ]
    }
  });
};
