/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'lh3.googleusercontent.com',  // Google profile pictures
      'avatars.githubusercontent.com',  // GitHub profile pictures (if needed)
      'iamsccvlyhmdnkawuich.supabase.co'  // Your Supabase storage domain
    ]
  }
}

module.exports = nextConfig 