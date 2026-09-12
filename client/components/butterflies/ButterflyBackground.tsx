"use client";

import dynamic from "next/dynamic";

const Butterflies = dynamic(
  () => import("@/components/butterflies/Butterflies"),
  { ssr: false },
);

export default function ButterflyBackground() {
  return <Butterflies />;
}
