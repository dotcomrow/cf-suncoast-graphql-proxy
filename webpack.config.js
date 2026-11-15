import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  entry: "./src/index.js",
  mode: "production",
  optimization: {
    minimize: true,
  },
  performance: {
    hints: false,
  },
  output: {
    path: __dirname + "/dist",
    publicPath: "dist",
    filename: "index.mjs",
    library: {
      type: "module",
    },
  },
  experiments: {
    outputModule: true,
  },
};
