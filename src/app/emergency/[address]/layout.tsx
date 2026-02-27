/** For static export: one placeholder so build succeeds. */
export function generateStaticParams() {
  return [{ address: "placeholder" }];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
