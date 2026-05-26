"use client";

/**
 * pure/ — Pure design-system component kit.
 *
 * Self-contained: tokens, typography, low-level utilities, and all
 * component styles ship under `./styles/`. No legacy frontier.css
 * dependency. Drop <PureShell> into any page and you have the kit.
 *
 * Each component lives in its own file under `./components/` and
 * imports its own CSS from `./styles/components/`. Shared types
 * and helpers live in `./types`.
 */

import "./styles/index.css";

export * from "./types";
export * from "./components/PureShell";
export * from "./components/PureNav";
export * from "./components/PureFooter";
export * from "./components/PureHero";
export * from "./components/PureSection";
export * from "./components/PureCTABand";
export * from "./components/PurePillarGrid";
export * from "./components/PureFeatureGrid";
export * from "./components/PureFigureGrid";
export * from "./components/PureBeforeAfter";
export * from "./components/PureTimeline";
export * from "./components/PureGallery";
export * from "./components/PureEcoFlow";
export * from "./components/PureCompareTable";
export * from "./components/PurePricingGrid";
export * from "./components/PureChip";
export * from "./components/PureProviderChip";
export * from "./components/PureButton";
export * from "./components/ProviderIcon";
export * from "./components/PureTrustStrip";
export * from "./components/PureFAQ";
export * from "./components/PureEmailSignup";
export * from "./components/PureStepFlow";
export * from "./components/PureProse";
export * from "./components/PureCodeBlock";
export * from "./components/PureTOC";
