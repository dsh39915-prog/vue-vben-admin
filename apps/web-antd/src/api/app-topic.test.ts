import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addAppTopicAppsApi,
  getAppTopicAppsApi,
  getAppTopicCandidatesApi,
  getAppTopicListApi,
  getAppTopicOptionsApi,
  removeAppTopicAppsApi,
  removeAppTopicsApi,
  saveAppTopicApi,
  updateAppTopicAppApi,
} from './app-topic';

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('#/api/request', () => ({ configInfoRequestClient: client }));
beforeEach(() => vi.resetAllMocks());

describe('应用列表专题接口契约', () => {
  it('候选排序通过sort1提交，软件/游戏筛选sort及专题sid保持不变', async () => {
    for (const sort1 of ['downloadCount', 'appStorePrice'] as const) {
      for (const order of ['asc', 'desc'] as const) {
        const query = {
          page: 2,
          pageSize: 20,
          sid: 25,
          sort: '2' as const,
          type: 203,
          searchKeyType: 1 as const,
          searchKeyText: '445',
          platform: 103,
          sort1,
          order,
        };
        await getAppTopicCandidatesApi(query);
        expect(client.post).toHaveBeenLastCalledWith(
          '/adAppspecial/getAppDeInfoList',
          query,
        );
      }
    }
  });
  it('专题筛选保留数字0，新增不传id，编辑传专题id与日期字符串', async () => {
    const query = {
      status: 0,
      isShowName: 2,
      remd: 3,
      platform: 102,
      name: '游戏',
      page: 1,
      pageSize: 20,
    };
    await getAppTopicListApi(query);
    expect(client.post).toHaveBeenLastCalledWith(
      '/adAppspecial/findAppSpecialList',
      query,
    );
    const data = {
      name: '测试专题',
      title: '专题标题',
      remd: 3,
      site: 0,
      platform: 103,
      isShowName: 1,
      onLineTime: '2026-11-25',
      offLineTime: '2026-12-31',
    };
    await saveAppTopicApi(data);
    expect(client.post).toHaveBeenLastCalledWith(
      '/adAppspecial/addOrModifyAppSpecial',
      data,
    );
    await saveAppTopicApi({ ...data, id: 25 });
    expect(client.post).toHaveBeenLastCalledWith(
      '/adAppspecial/addOrModifyAppSpecial',
      { ...data, id: 25 },
    );
  });
  it('平台专题与专题内应用使用真实平台和sid，分页从1开始', async () => {
    await getAppTopicOptionsApi(103);
    expect(client.get).toHaveBeenLastCalledWith(
      '/adAppspecial/findAppSpecialToNameList/103',
    );
    await getAppTopicAppsApi({ sid: 25, page: 1, pageSize: 20 });
    expect(client.post).toHaveBeenLastCalledWith(
      '/adAppspecial/findAppApecialInfoBySid',
      { sid: 25, page: 1, pageSize: 20 },
    );
  });
  it('候选应用传字符串sort、当前sid，搜索类型1为应用ID', async () => {
    const query = {
      sort: '2' as const,
      type: 203,
      searchKeyType: 1 as const,
      searchKeyText: '285765',
      platform: -1,
      page: 2,
      pageSize: 20,
      sid: 25,
    };
    await getAppTopicCandidatesApi(query);
    expect(client.post).toHaveBeenLastCalledWith(
      '/adAppspecial/getAppDeInfoList',
      query,
    );
  });
  it('添加传应用ID数组，移除传关联ID，专题删除传专题ID，修改保留排序0', async () => {
    await addAppTopicAppsApi({ sid: 25, ids: [283_393, 285_765] });
    expect(client.post).toHaveBeenLastCalledWith(
      '/adAppspecial/addAppToAppSpecialInfo',
      { sid: 25, ids: [283_393, 285_765] },
    );
    await updateAppTopicAppApi({ id: 5941, appName: '专题内名称', remd: 0 });
    expect(client.post).toHaveBeenLastCalledWith(
      '/adAppspecial/updateAppSpecialInfo',
      { id: 5941, appName: '专题内名称', remd: 0 },
    );
    await removeAppTopicAppsApi([5941, 5942]);
    expect(client.post).toHaveBeenLastCalledWith(
      '/adAppspecial/removeAppSpecialInfo',
      { ids: [5941, 5942] },
    );
    await removeAppTopicsApi([25, 38]);
    expect(client.post).toHaveBeenLastCalledWith(
      '/adAppspecial/removeAppSpecialById',
      { ids: [25, 38] },
    );
  });
});
