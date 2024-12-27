This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# Real Estate Listing Manager

## Edge Functions

### Deploying Edge Functions

To deploy or update the edge functions, run:

```bash
supabase functions deploy generate-description --project-ref your-project-ref
```

Make sure you have:
1. Installed the Supabase CLI
2. Logged in to Supabase (`supabase login`)
3. Set your project ref (find it in your Supabase dashboard)

### Environment Variables

If your edge function requires environment variables:

```bash
supabase secrets set --project-ref your-project-ref OPENAI_API_KEY=your-api-key
```

### Testing Edge Functions

Test the function locally:

```bash
supabase start
supabase functions serve generate-description --env-file .env.local
```

## Development Setup

[Rest of existing README content...]
