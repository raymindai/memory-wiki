"use client";

import "../styles/components/pure-provider-chip.css";
import type { ProviderBrand } from "../types";
import { PureChip } from "./PureChip";
import { ProviderIcon } from "./ProviderIcon";

/**
 * PureProviderChip — chip with a brand provider icon.
 */
export function PureProviderChip({
  brand,
  label,
  href,
}: {
  brand: ProviderBrand;
  label: string;
  href?: string;
}) {
  return (
    <PureChip href={href} leading={<ProviderIcon brand={brand} />}>{label}</PureChip>
  );
}
