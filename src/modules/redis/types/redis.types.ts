export type addMemberToZsetType = {
  key: string;
  value: string;
  score: number;
};

export type deleteZsetMembersType = {
  key: string;
  min: number;
  max: number;
};
