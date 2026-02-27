/** For static export: one placeholder so build succeeds. */
export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
