import { requestClient } from '#/api/request';

export interface SimpleNamedRecord {
  id: number;
  name: string;
}

export interface UserProfile {
  avatar?: string;
  createTime: string;
  dept?: SimpleNamedRecord;
  email?: string;
  id: number;
  loginDate: string;
  loginIp: string;
  mobile?: string;
  nickname: string;
  posts: SimpleNamedRecord[];
  roles: SimpleNamedRecord[];
  sex?: number;
  username: string;
}

export interface UserProfileUpdate {
  avatar?: string;
  email?: string;
  mobile?: string;
  nickname?: string;
  sex?: number;
}

export const getUserProfileApi = () =>
  requestClient.get<UserProfile>('/system/user/profile/get');

export const updateUserProfileApi = (data: UserProfileUpdate) =>
  requestClient.put<boolean>('/system/user/profile/update', data);

export const updateUserProfilePasswordApi = (
  oldPassword: string,
  newPassword: string,
) =>
  requestClient.put<boolean>('/system/user/profile/update-password', {
    newPassword,
    oldPassword,
  });
