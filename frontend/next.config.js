/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // آدرس CDN تصاویر محصولات بعداً هنگام مشخص شدن Storage نهایی اضافه می‌شود
    ],
  },
};

module.exports = nextConfig;
