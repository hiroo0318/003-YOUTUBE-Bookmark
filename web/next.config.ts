import type { NextConfig } from "next";

// 모든 화면이 로그인한 가족 구성원별 데이터라 Cache Components를 쓰지 않고 요청마다 렌더링한다.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
