<script setup lang="ts">
import { useUserStore } from '@vben/stores';

import { Descriptions, DescriptionsItem, Tag } from 'ant-design-vue';
const users = useUserStore();
</script>
<template>
  <Descriptions v-if="users.userInfo" :column="1" bordered>
    <DescriptionsItem label="登录名">
      {{ users.userInfo.username }}
    </DescriptionsItem>
    <DescriptionsItem label="姓名">
      {{ users.userInfo.realName }}
    </DescriptionsItem>
    <DescriptionsItem label="昵称">
      {{ users.userInfo.nickname || '—' }}
    </DescriptionsItem>
    <DescriptionsItem label="联系电话">
      {{ users.userInfo.mobile || '—' }}
    </DescriptionsItem>
    <DescriptionsItem label="角色">
      <Tag v-for="role in users.userRoles" :key="role">
        {{ role }}
      </Tag>
    </DescriptionsItem>
  </Descriptions>
</template>
