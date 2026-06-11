// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export { ChannelHeader, ChannelPageLayout, type SiteNavId } from './ChannelPageLayout'
export { ProfileCover, ProfileHero, ProfilePageLayout } from './ProfilePageLayout'
export { SmartLinkPageLayout } from './SmartLinkPageLayout'
export { StudioShell } from './StudioShell'
export { StudioTopNav } from './StudioTopNav'
export { StudioSidebar } from './StudioSidebar'
export { StudioMobileNav } from './StudioMobileNav'
export { PublicBrandShell } from './PublicBrandShell'
export { PublicFooter, type PublicFooterProps } from './PublicFooter'
export { PublicPageHeader } from './PublicPageHeader'
export type { PublicPageHeaderProps } from './PublicPageHeader'
export { StudioTabs } from './StudioTabs'
export type {
  StudioTabsProps,
  StudioTabsListProps,
  StudioTabsTriggerProps,
  StudioTabsPanelProps,
} from './StudioTabs'
export { StudioCollapse } from './StudioCollapse'
export type { StudioCollapseProps } from './StudioCollapse'
export { BrandLogo } from './BrandLogo'
export { BrowserFrame } from './BrowserFrame'
export { EmbedShell } from './EmbedShell'
export {
  StatCard,
  StatCardGrid,
  StatCardStrip,
  type StatCardProps,
  type StatCardGridProps,
  type StatCardStripProps,
  type StatCardLayout,
  type StatCardSize,
} from './StatCard'
export {
  BrandText,
  BrandHeading,
  BrandSectionLabel,
  type BrandTextProps,
  type BrandTextSize,
  type BrandTextTone,
  type BrandHeadingProps,
  type BrandHeadingLevel,
  type BrandSectionLabelProps,
} from './Typography'
export { BrandButton, type BrandButtonProps, type BrandButtonVariant } from './Button'
export { Pill, type PillProps, type PillVariant } from './Pill'
export { BrandInput, BrandField, type BrandInputProps, type BrandFieldProps } from './Input'
export { CoverArt, type CoverArtProps, type CoverArtSize } from './CoverArt'
export { AvatarTile, type AvatarTileProps } from './AvatarTile'
export { PinnedAnnouncement, type PinnedAnnouncementProps } from './PinnedAnnouncement'
export { WaveformPlayer, type WaveformPlayerProps } from './WaveformPlayer'
export {
  BroadcastStatusBar,
  type BroadcastStatusBarProps,
  type BroadcastState,
} from './BroadcastStatusBar'
export {
  LiveChatPanel,
  type LiveChatPanelProps,
  type LiveChatMessage,
  type LiveChatSurface,
} from './LiveChatPanel'
export { StickyLiveBar, type StickyLiveBarProps } from './StickyLiveBar'
export { flagEmoji } from '../lib/flag-emoji'
export {
  SidebarNav,
  SidebarNavItem,
  type SidebarNavProps,
  type SidebarNavItemProps,
  type SidebarNavIcon,
} from './SidebarNav'
export { coverGradientFromId, COVER_GRADIENTS, type CoverGradient } from '../lib/cover-gradient'
export { initialsFromName } from '../lib/initials'
export { chatHandleVariant, CHAT_HANDLE_VARIANTS, type ChatHandleVariant } from '../lib/chat-handle'
export { WAVEFORM_BAR_HEIGHTS, formatPlayerTime } from '../lib/waveform-player'
export { DashboardShell, type DashboardShellProps, type DashboardNavItem } from './DashboardShell'
export { ChannelPageShell } from './ChannelPageShell'
export { PublicShell, type PublicShellProps } from './PublicShell'
export { AdminShell, type AdminShellProps } from './AdminShell'
export { AdminShellHeader, type AdminShellHeaderProps } from './AdminShellHeader'
export { DASHBOARD_NAV, DASHBOARD_HASH_ALIASES, normaliseDashboardHash } from './dashboard-nav'
export type { DashboardNavDefinition } from './dashboard-nav'
export { SidebarNavLink, type SidebarNavLinkProps, type SidebarNavSurface } from './SidebarNavLink'
export { SidebarNavIconSvg } from './SidebarNav'
export { ReleaseSmartLink, type ReleaseSmartLinkProps } from './ReleaseSmartLink'
export {
  DspLinkButton,
  DspLinkButtonList,
  type DspLinkButtonProps,
  type DspPlatform,
} from './DspLinkButton'
export { TierCard, TierCardGrid, type TierCardProps, type TierCardGridProps } from './TierCard'
export {
  KpiCard,
  KpiCardRow,
  StatusPill,
  DataRowList,
  DataRowListHeader,
  DataRowListRow,
  DataRowListEmpty,
  MoneyCell,
  AdminMiniSidebar,
  AdminContextStrip,
  MoneyBreakdown,
  ProgressBar,
  type KpiColor,
  type KpiCardProps,
  type KpiCardRowProps,
  type StatusPillTone,
  type StatusPillProps,
  type DataRowListProps,
  type DataRowListHeaderProps,
  type DataRowListRowProps,
  type DataRowListEmptyProps,
  type MoneyCellProps,
  type AdminMiniSidebarItem,
  type AdminMiniSidebarGroup,
  type AdminMiniSidebarProps,
  type AdminContextStripProps,
  type MoneyBreakdownLine,
  type MoneyBreakdownProps,
  type ProgressBarProps,
} from './AdminPrimitives'
export { fanSubBreakdownLines } from './fan-sub-breakdown'
