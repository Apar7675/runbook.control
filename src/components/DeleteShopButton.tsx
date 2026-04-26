"use client";

import Link from "next/link";
import React from "react";

export default function DeleteShopButton({
  shopId,
}: {
  shopId: string;
  shopName: string;
}) {
  return (
    <Link
      href={`/shops/${shopId}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "8px 12px",
        borderRadius: 12,
        fontWeight: 900,
        border: "1px solid rgba(255,120,120,0.22)",
        background: "rgba(120,24,24,0.35)",
        color: "#ffd6d6",
        textDecoration: "none",
      }}
      title="Open the shop danger zone"
    >
      Open Danger Zone
    </Link>
  );
}
