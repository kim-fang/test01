export type Message = {
  id: string;
  code: string;
  name: string;
  branchType: string;
  serviceType: string;
  organizationType: string;
  status: string;
  anomalyStatus: string;
  ownerOrganization: string;
  hubCenter: string;
  province: string;
  department: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type MessageInput = {
  name: string;
  content: string;
};

export type NetworkPointImportRow = {
  code: string;
  name: string;
  branchType: string;
  serviceType: string;
  organizationType: string;
  status: string;
  anomalyStatus: string;
  ownerOrganization: string;
  hubCenter: string;
  content: string;
};
