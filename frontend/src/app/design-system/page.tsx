import { notFound } from "next/navigation";
import { Showcase } from "./Showcase";

export const metadata = { title: "Design System" };

/** صفحه داخلی مرور Componentها؛ فقط در Development در دسترس است. */
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Showcase />;
}
