// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { Button } from '@tahti/ui'
import type { PluginInstance } from '@tahti/audio-edit'
import type { GainParams } from '@tahti/audio-edit'
import type { EqParams } from '@tahti/audio-edit'
import type { CompParams } from '@tahti/audio-edit'
import type { LimiterParams } from '@tahti/audio-edit'
import type { FilterParams } from '@tahti/audio-edit'
import {
  gainChainSummary,
  eqChainSummary,
  compChainSummary,
  limiterChainSummary,
  filterChainSummary,
  DEFAULT_GAIN_PARAMS,
  DEFAULT_EQ_PARAMS,
  DEFAULT_COMP_PARAMS,
  DEFAULT_LIMITER_PARAMS,
  DEFAULT_FILTER_PARAMS,
} from '@tahti/audio-edit'
import { GainPanel } from '@/lib/audio-editor/panels/GainPanel'
import { EqPanel } from '@/lib/audio-editor/panels/EqPanel'
import { CompPanel } from '@/lib/audio-editor/panels/CompPanel'
import { LimiterPanel } from '@/lib/audio-editor/panels/LimiterPanel'
import { FilterPanel } from '@/lib/audio-editor/panels/FilterPanel'
import { ChainTile, Switch, cx } from './pro-audio-editor-controls'

export function ProAudioEditorChain({
  plugins,
  pluginsExpanded,
  onPluginsExpandedChange,
  focusedInstanceId,
  onFocusInstanceId,
  previewBypassedPluginId,
  onPreviewBypassedPluginIdChange,
  onPreviewModeAfter,
  togglePlugin,
  patchPlugin,
  focusedPlugin,
  gainPlugin,
  eqPlugin,
  compPlugin,
  limiterPlugin,
  filterPlugin,
  gainParams,
  eqParams,
  compParams,
  limiterParams,
  filterParams,
  measuring,
  onMeasure,
  onKnobDragStart,
}: {
  plugins: PluginInstance[]
  pluginsExpanded: boolean
  onPluginsExpandedChange: (expanded: boolean) => void
  focusedInstanceId: string
  onFocusInstanceId: (instanceId: string) => void
  previewBypassedPluginId: string | null
  onPreviewBypassedPluginIdChange: (instanceId: string | null) => void
  onPreviewModeAfter: () => void
  togglePlugin: (instanceId: string, enabled: boolean) => void
  patchPlugin: (instanceId: string, params: unknown) => void
  focusedPlugin: PluginInstance
  gainPlugin: PluginInstance | undefined
  eqPlugin: PluginInstance | undefined
  compPlugin: PluginInstance | undefined
  limiterPlugin: PluginInstance | undefined
  filterPlugin: PluginInstance | undefined
  gainParams: GainParams | undefined
  eqParams: EqParams | undefined
  compParams: CompParams | undefined
  limiterParams: LimiterParams | undefined
  filterParams: FilterParams | undefined
  measuring: boolean
  onMeasure: () => void
  onKnobDragStart: () => void
}) {
  const pluginPosition = (instanceId: string) =>
    plugins.findIndex((p) => p.instanceId === instanceId) + 1

  return (
    <>
      <div className="pro-editor-chain">
        <div className="pro-editor-chain__header">
          <span>PLUGIN CHAIN · {plugins.filter((plugin) => plugin.enabled).length} ACTIVE</span>
          <button
            type="button"
            className="pro-editor-chain__collapse"
            aria-expanded={pluginsExpanded}
            onClick={() => onPluginsExpandedChange(!pluginsExpanded)}
          >
            {pluginsExpanded ? 'Collapse' : 'Open plugins'}
          </button>
        </div>
        {pluginsExpanded ? (
          <div className="pro-editor-chain__strip">
            {plugins.map((plugin, i) => {
              let summary = ''
              if (plugin.pluginId === 'gain')
                summary = gainChainSummary(plugin.params as GainParams, plugin.enabled)
              else if (plugin.pluginId === 'eq')
                summary = eqChainSummary(plugin.params as EqParams, plugin.enabled)
              else if (plugin.pluginId === 'comp')
                summary = compChainSummary(plugin.params as CompParams, plugin.enabled)
              else if (plugin.pluginId === 'limiter')
                summary = limiterChainSummary(plugin.params as LimiterParams, plugin.enabled)
              else if (plugin.pluginId === 'filter')
                summary = filterChainSummary(plugin.params as FilterParams, plugin.enabled)

              const pluginName =
                plugin.pluginId === 'gain'
                  ? 'Gain'
                  : plugin.pluginId === 'eq'
                    ? 'EQ'
                    : plugin.pluginId === 'comp'
                      ? 'Comp'
                      : plugin.pluginId === 'limiter'
                        ? 'Limiter'
                        : 'Filter'

              return (
                <div key={plugin.instanceId} className="pro-editor-chain__cell">
                  {i > 0 && (
                    <span className="pro-editor-chain__arrow" aria-hidden>
                      →
                    </span>
                  )}
                  <div className="pro-editor-chain__tile">
                    <ChainTile
                      position={i + 1}
                      name={pluginName}
                      summary={summary}
                      enabled={plugin.enabled}
                      focused={plugin.instanceId === focusedInstanceId}
                      onFocus={() => onFocusInstanceId(plugin.instanceId)}
                      onToggle={(v) => togglePlugin(plugin.instanceId, v)}
                    />
                    <button
                      type="button"
                      className={cx(
                        'pro-editor-plugin-preview',
                        previewBypassedPluginId === plugin.instanceId && 'is-active',
                      )}
                      disabled={!plugin.enabled}
                      onClick={() => {
                        onPreviewModeAfter()
                        onPreviewBypassedPluginIdChange(
                          previewBypassedPluginId === plugin.instanceId ? null : plugin.instanceId,
                        )
                      }}
                    >
                      {previewBypassedPluginId === plugin.instanceId
                        ? 'Playing without this plugin'
                        : 'Preview before / after'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="pro-editor-chain__empty">
            No active effects. Open plugins to build a chain.
          </p>
        )}
      </div>

      {pluginsExpanded ? (
        <div className="pro-editor-panel-area">
          <div
            className={cx(
              'pro-editor-panel',
              !focusedPlugin.enabled && 'pro-editor-panel--disabled',
            )}
          >
            <div className="pro-editor-panel__header">
              <div className="pro-editor-panel__heading">
                <h2 className="pro-editor-panel__title">
                  {focusedPlugin.pluginId === 'gain'
                    ? 'Gain & Normalize'
                    : focusedPlugin.pluginId === 'eq'
                      ? 'EQ — 3 band parametric'
                      : focusedPlugin.pluginId === 'comp'
                        ? 'Compressor'
                        : focusedPlugin.pluginId === 'limiter'
                          ? 'Limiter'
                          : 'Filter'}
                </h2>
                <span className="pro-editor-panel__pill">
                  POSITION {pluginPosition(focusedPlugin.instanceId)} ·{' '}
                  {focusedPlugin.enabled ? 'ENABLED' : 'BYPASSED'}
                </span>
              </div>
              <div className="pro-editor-panel__actions">
                <Button
                  onClick={() => {
                    const defaults =
                      focusedPlugin.pluginId === 'gain'
                        ? { ...DEFAULT_GAIN_PARAMS }
                        : focusedPlugin.pluginId === 'eq'
                          ? { ...DEFAULT_EQ_PARAMS }
                          : focusedPlugin.pluginId === 'comp'
                            ? { ...DEFAULT_COMP_PARAMS }
                            : focusedPlugin.pluginId === 'limiter'
                              ? { ...DEFAULT_LIMITER_PARAMS }
                              : { ...DEFAULT_FILTER_PARAMS }
                    patchPlugin(focusedPlugin.instanceId, defaults)
                  }}
                  variant="ghost"
                  size="sm"
                >
                  Reset
                </Button>
                <Switch
                  checked={focusedPlugin.enabled}
                  onChange={(v) => togglePlugin(focusedPlugin.instanceId, v)}
                  label={`${focusedPlugin.pluginId} enabled`}
                />
              </div>
            </div>
            <div onPointerDown={onKnobDragStart}>
              {focusedPlugin.pluginId === 'gain' && gainPlugin && gainParams && (
                <GainPanel
                  params={gainParams}
                  onChange={(p) => patchPlugin(gainPlugin.instanceId, p)}
                  measured={gainParams.measured}
                  onMeasure={onMeasure}
                  measuring={measuring}
                />
              )}
              {focusedPlugin.pluginId === 'eq' && eqPlugin && eqParams && (
                <EqPanel params={eqParams} onChange={(p) => patchPlugin(eqPlugin.instanceId, p)} />
              )}
              {focusedPlugin.pluginId === 'comp' && compPlugin && compParams && (
                <CompPanel
                  params={compParams}
                  onChange={(p) => patchPlugin(compPlugin.instanceId, p)}
                />
              )}
              {focusedPlugin.pluginId === 'limiter' && limiterPlugin && limiterParams && (
                <LimiterPanel
                  params={limiterParams}
                  onChange={(p) => patchPlugin(limiterPlugin.instanceId, p)}
                />
              )}
              {focusedPlugin.pluginId === 'filter' && filterPlugin && filterParams && (
                <FilterPanel
                  params={filterParams}
                  onChange={(p) => patchPlugin(filterPlugin.instanceId, p)}
                />
              )}
            </div>
            <p className="pro-editor-panel__hint">
              drag knob · double-click to type · ⌥drag = fine · scroll = step
            </p>
          </div>
        </div>
      ) : null}
    </>
  )
}
