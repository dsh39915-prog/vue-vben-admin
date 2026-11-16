<script setup lang="ts">
import type { Component } from 'vue';

import type { LayoutType } from '@vben/types';

import { computed } from 'vue';

import { CircleHelp } from '@vben/icons';
import { getText } from '@vben/texts';

import { VbenTooltip } from '@vben-core/shadcn-ui';

import {
  FullContent,
  HeaderMixedNav,
  HeaderNav,
  HeaderSidebarNav,
  MixedNav,
  SidebarMixedNav,
  SidebarNav,
} from '../../icons';

interface PresetItem {
  name: string;
  tip: string;
  type: LayoutType;
}

defineOptions({
  name: 'PreferenceLayout',
});

const modelValue = defineModel<LayoutType>({ default: 'sidebar-nav' });

const components: Record<LayoutType, Component> = {
  'full-content': FullContent,
  'header-nav': HeaderNav,
  'mixed-nav': MixedNav,
  'sidebar-mixed-nav': SidebarMixedNav,
  'sidebar-nav': SidebarNav,
  'header-mixed-nav': HeaderMixedNav,
  'header-sidebar-nav': HeaderSidebarNav,
};

const PRESET = computed((): PresetItem[] => [
  {
    name: getText('preferences.vertical'),
    tip: getText('preferences.verticalTip'),
    type: 'sidebar-nav',
  },
  {
    name: getText('preferences.twoColumn'),
    tip: getText('preferences.twoColumnTip'),
    type: 'sidebar-mixed-nav',
  },
  {
    name: getText('preferences.horizontal'),
    tip: getText('preferences.horizontalTip'),
    type: 'header-nav',
  },
  {
    name: getText('preferences.headerSidebarNav'),
    tip: getText('preferences.headerSidebarNavTip'),
    type: 'header-sidebar-nav',
  },
  {
    name: getText('preferences.mixedMenu'),
    tip: getText('preferences.mixedMenuTip'),
    type: 'mixed-nav',
  },
  {
    name: getText('preferences.headerTwoColumn'),
    tip: getText('preferences.headerTwoColumnTip'),
    type: 'header-mixed-nav',
  },
  {
    name: getText('preferences.fullContent'),
    tip: getText('preferences.fullContentTip'),
    type: 'full-content',
  },
]);

function activeClass(theme: string): string[] {
  return theme === modelValue.value ? ['outline-box-active'] : [];
}
</script>

<template>
  <div class="flex w-full flex-wrap gap-5">
    <template v-for="theme in PRESET" :key="theme.name">
      <div
        class="flex w-25 cursor-pointer flex-col"
        @click="modelValue = theme.type"
      >
        <div :class="activeClass(theme.type)" class="outline-box flex-center">
          <component :is="components[theme.type]" />
        </div>
        <div
          class="mt-2 flex-center text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {{ theme.name }}
          <VbenTooltip v-if="theme.tip" side="bottom">
            <template #trigger>
              <CircleHelp class="ml-1 size-3 cursor-help" />
            </template>
            {{ theme.tip }}
          </VbenTooltip>
        </div>
      </div>
    </template>
  </div>
</template>
