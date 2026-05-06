import { z } from "zod";

const trimmedString = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max);

export const networkPointHeaders = [
  "机构编号",
  "机构名称",
  "机构类型",
  "服务类型",
  "机构性质",
  "机构状态",
  "异常状态",
  "所属机构",
  "首分拨中心",
  "备注",
] as const;

export const branchTypeOptions = [
  "一级网点",
  "二级网点",
  "三级网点",
  "直营服务部",
] as const;

export const serviceTypeOptions = [
  "寄件服务",
  "冷链运输",
  "仓配服务",
  "派件服务",
] as const;

export const organizationTypeOptions = [
  "市场部",
  "承包区",
  "一级网点",
  "二级网点",
] as const;

export const statusOptions = ["正常", "筹备中"] as const;
export const anomalyStatusOptions = ["正常", "筹备期", "观察中"] as const;

export const ownerOrganizationOptions = [
  "上海市场部",
  "杭州分拨中心",
  "南京分拨中心",
  "呼和浩特事业网点",
  "郑州分拨中心",
  "厦门分拨中心",
] as const;

export const hubCenterOptions = [
  "上海分拨中心",
  "杭州分拨中心",
  "南京分拨中心",
  "郑州分拨中心",
  "长沙分拨中心",
  "厦门分拨中心",
] as const;

export const provinceOptions = [
  "上海市",
  "浙江省",
  "江苏省",
  "河南省",
  "福建省",
  "内蒙古",
] as const;

export const departmentOptions = [
  "市场运营",
  "直营网点",
  "冷链车队",
  "直营网格",
  "客服中心",
] as const;

export const messageInputSchema = z.object({
  name: trimmedString(1, 80),
  content: z.string().trim().max(500),
});

export const messageIdSchema = z.string().uuid();

export const importedNetworkPointSchema = z.object({
  code: trimmedString(1, 40),
  name: trimmedString(1, 80),
  branchType: z.enum(branchTypeOptions),
  serviceType: z.enum(serviceTypeOptions),
  organizationType: z.enum(organizationTypeOptions),
  status: z.enum(statusOptions),
  anomalyStatus: z.enum(anomalyStatusOptions),
  ownerOrganization: z.enum(ownerOrganizationOptions),
  hubCenter: z.enum(hubCenterOptions),
  content: z.string().trim().max(500),
});

export const importPayloadSchema = z
  .object({
    headers: z.array(z.string()),
    rows: z.array(importedNetworkPointSchema).min(1),
  })
  .superRefine((payload, context) => {
    if (payload.headers.length !== networkPointHeaders.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "模板表头数量不正确，请使用系统提供的导入模板。",
      });
      return;
    }

    const invalidHeader = networkPointHeaders.find(
      (header, index) => payload.headers[index] !== header,
    );

    if (invalidHeader) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "模板表头不匹配，请确认 Excel 模板未被修改。",
      });
    }
  });
