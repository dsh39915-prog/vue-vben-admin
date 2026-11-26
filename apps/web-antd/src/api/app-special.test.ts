import { describe, expect, it, vi } from 'vitest';

import {
  addAppSpecialAppsApi,
  getAppSpecialCandidateListApi,
  getAppSpecialCategoriesApi,
  getAppSpecialListApi,
  removeAppSpecialAppsApi,
  updateAppSpecialOrderApi,
} from './app-special';

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('#/api/request', () => ({ configInfoRequestClient: client }));

describe('一级专题接口契约', () => {
  it('列表只传分页，候选查询保留数字分类、字符串搜索和逗号分隔价格类型', async () => {
    await getAppSpecialListApi({ page: 2, pageSize: 20 });
    expect(client.post).toHaveBeenLastCalledWith(
      '/appSpecialList/getAppOrGameListPage',
      { page: 2, pageSize: 20 },
    );
    const query = {
      page: 1,
      pageSize: 20,
      type: -1,
      searchKeyType: '2' as const,
      searchKeyText: '165776',
      isFree: '0,2',
    };
    await getAppSpecialCandidateListApi(query);
    expect(client.post).toHaveBeenLastCalledWith(
      '/appSpecialList/getAllAppOrGameListPage',
      query,
    );
    await getAppSpecialCategoriesApi();
    expect(client.post).toHaveBeenLastCalledWith('/appType/typeList', {
      sort: 0,
    });
  });
  it('添加传appId，移除传专题记录id，通过GET传逗号分隔ID，排序保留0', async () => {
    await addAppSpecialAppsApi([165_776, 151_375]);
    expect(client.get).toHaveBeenLastCalledWith(
      '/appSpecialList/addSpecialAppOrGame/165776,151375',
    );
    await removeAppSpecialAppsApi([2818, 2816]);
    expect(client.get).toHaveBeenLastCalledWith(
      '/appSpecialList/removeSpecialAppOrGame/2818,2816',
    );
    await updateAppSpecialOrderApi({ id: 2818, order: 0 });
    expect(client.post).toHaveBeenLastCalledWith(
      '/appSpecialList/updateSpecialAppOrGameOrder',
      { id: 2818, order: 0 },
    );
  });
});
