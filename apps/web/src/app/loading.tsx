// GlobalLoaderHost in Providers.tsx is the single app-wide loader.
// This file must not render any spinner to avoid duplicates.
export default function Loading() {
  return null;
}