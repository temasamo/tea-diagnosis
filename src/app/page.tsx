"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // 自動的に /tea/diagnosis にリダイレクト
    router.push("/tea/diagnosis");
  }, [router]);

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      fontSize: "18px",
      color: "#666"
    }}>
      お茶診断AIにリダイレクト中...
    </div>
  );
}
