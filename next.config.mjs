/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      "lh3.googleusercontent.com",      // Google profile pictures
      "avatars.githubusercontent.com",  // GitHub avatars
      "secure.gravatar.com",            // optional fallback
    ],
  },
};

export default nextConfig;
