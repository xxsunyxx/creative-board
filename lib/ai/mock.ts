export type KeywordInput = {
  title: string;
  content?: string | null;
};

export type MergeInput = KeywordInput & {
  keywords: string[];
};

export type GeneratedDimensionDetail = {
  label: string;
  children?: string[];
};

export type GeneratedDimension = {
  label: string;
  details: GeneratedDimensionDetail[];
};

const STOP_WORDS = new Set([
  "的",
  "了",
  "但",
  "和",
  "与",
  "是",
  "在",
  "有",
  "也",
  "就",
  "都",
  "而",
  "及",
  "或",
  "一个",
  "一种",
  "这个",
  "那个",
  "我们",
  "他们",
]);

const LEADING_WORDS =
  /^(但是|但|而且|并且|所以|因为|如果|可以|需要|通过|对于|关于|以及|还有|同时|然后)/;

export function extractKeywords(input: KeywordInput): string[] {
  const title = input.title.trim();
  const segments = (input.content ?? "")
    .split(/[，。、；：！？\n,.;:!?()（）【】\[\]“”"'’·]+/g)
    .map((part) => part.trim())
    .map((part) => part.replace(LEADING_WORDS, "").trim())
    .filter((part) => part.length >= 2 && part.length <= 12)
    .filter((part) => !STOP_WORDS.has(part))
    .filter((part) => part !== title);

  return Array.from(new Set([title, ...segments].filter(Boolean))).slice(0, 5);
}

export function mergeInspirations(a: MergeInput, b: MergeInput) {
  const keywords = Array.from(
    new Set([...a.keywords, ...b.keywords]),
  ).slice(0, 8);

  return {
    title: `${a.title} × ${b.title}`,
    content: [
      `融合自「${a.title}」与「${b.title}」。`,
      "",
      `A · ${a.content || "暂无内容"}`,
      "",
      `B · ${b.content || "暂无内容"}`,
      "",
      "待整理：找出共同点、差异，以及可以继续推进的方向。",
    ].join("\n"),
    keywords,
  };
}

function d(label: string, children?: string[]): GeneratedDimensionDetail {
  return children ? { label, children } : { label };
}

function genericDimensions(aTitle: string, bTitle: string): GeneratedDimension[] {
  return [
    {
      label: "机制",
      details: [
        d("触发器"),
        d("放大器"),
        d("瓶颈"),
        d("反馈回路", ["正反馈", "负反馈", "延迟反馈"]),
      ],
    },
    {
      label: "关系",
      details: [
        d(`${aTitle} → ${bTitle}`),
        d(`${bTitle} → ${aTitle}`),
        d("双向互构"),
      ],
    },
    {
      label: "证据",
      details: [d("事实"), d("概率"), d("假设"), d("猜想")],
    },
    {
      label: "条件",
      details: [d("成立条件"), d("失效条件"), d("边界条件")],
    },
    {
      label: "价值 / 风险",
      details: [
        d("高价值低风险"),
        d("高价值高风险"),
        d("低价值低风险"),
        d("低价值高风险"),
      ],
    },
  ];
}

export function generateDimensions(
  relationType: string,
  aTitle = "A",
  bTitle = "B",
): GeneratedDimension[] {
  switch (relationType) {
    case "因果":
      return [
        {
          label: "机制",
          details: [
            d("触发器"),
            d("放大器"),
            d("瓶颈"),
            d("中介变量"),
            d("调节变量"),
            d("反馈回路", ["正反馈", "负反馈", "延迟反馈"]),
          ],
        },
        {
          label: "方向",
          details: [
            d(`${aTitle} → ${bTitle}`),
            d(`${bTitle} → ${aTitle}`),
            d("双向互构"),
            d("共同导致第三结果"),
          ],
        },
        {
          label: "时间",
          details: [
            d("即时"),
            d("短期"),
            d("长期"),
            d("滞后"),
            d("累积"),
            d("演化"),
          ],
        },
        {
          label: "证据",
          details: [
            d("事实必然"),
            d("概率较高"),
            d("合理假设"),
            d("隐喻启发"),
            d("纯猜想"),
            d("反例", ["同域反例", "跨域反例", "时间反例"]),
          ],
        },
        {
          label: "条件",
          details: [
            d("必要条件"),
            d("充分条件"),
            d("边界条件", ["规模", "时间", "文化"]),
            d("抑制条件"),
          ],
        },
        {
          label: "强度",
          details: [
            d("弱关联"),
            d("强因果"),
            d("瓶颈"),
            d("放大器"),
            d("触发器"),
          ],
        },
        {
          label: "主体",
          details: [
            d("用户"),
            d("团队"),
            d("组织"),
            d("技术"),
            d("市场"),
            d("社会"),
          ],
        },
        {
          label: "反事实",
          details: [
            d("若无 A 是否仍有 B"),
            d("替代解释"),
            d("混杂因素"),
            d("选择偏差"),
          ],
        },
      ];

    case "相关":
      return [
        {
          label: "方向",
          details: [d("同向"), d("反向"), d("滞后"), d("非线性")],
        },
        {
          label: "强度",
          details: [d("弱相关"), d("中等相关"), d("强相关"), d("极强相关")],
        },
        {
          label: "形态",
          details: [d("线性"), d("阈值"), d("U 型"), d("倒 U 型"), d("周期")],
        },
        {
          label: "混杂",
          details: [
            d("第三因素"),
            d("共同原因"),
            d("反向因果"),
            d("选择偏差"),
          ],
        },
        {
          label: "时间",
          details: [d("同期"), d("领先"), d("滞后"), d("累积")],
        },
        {
          label: "主体",
          details: [d("个体"), d("团队"), d("组织"), d("市场"), d("社会")],
        },
        {
          label: "证据",
          details: [d("观察"), d("统计"), d("实验"), d("案例"), d("传闻")],
        },
        {
          label: "可验证",
          details: [d("可量化"), d("可观察"), d("暂不可验证")],
        },
      ];

    case "类比":
      return [
        {
          label: "结构",
          details: [d("同构"), d("部分映射"), d("层级对应"), d("边界差异")],
        },
        {
          label: "机制",
          details: [d("可迁移"), d("不可迁移"), d("需改造"), d("仅表面相似")],
        },
        {
          label: "映射方向",
          details: [
            d(`${aTitle} → ${bTitle}`),
            d(`${bTitle} → ${aTitle}`),
            d("双向"),
          ],
        },
        {
          label: "迁移层级",
          details: [
            d("现象层"),
            d("结构层"),
            d("动力层"),
            d("语义层"),
            d("价值层"),
          ],
        },
        {
          label: "边界",
          details: [
            d("成立条件"),
            d("失效条件"),
            d("尺度差异", ["个体 vs 组织", "组织 vs 社会"]),
            d("文化差异"),
          ],
        },
        {
          label: "新颖度",
          details: [d("同域近迁移"), d("跨域远迁移"), d("反常识断裂")],
        },
        {
          label: "用途",
          details: [d("解释"), d("预测"), d("设计"), d("批判"), d("叙事")],
        },
      ];

    case "条件":
      return [
        {
          label: "前置条件",
          details: [d("资源"), d("能力"), d("意愿"), d("权限"), d("信息")],
        },
        {
          label: "边界条件",
          details: [
            d("规模"),
            d("时间"),
            d("文化", ["权力距离", "不确定性规避", "集体主义"]),
            d("法规"),
            d("技术成熟度"),
          ],
        },
        {
          label: "触发条件",
          details: [d("事件"), d("阈值"), d("频率"), d("强度"), d("时机")],
        },
        {
          label: "抑制条件",
          details: [d("资源不足"), d("能力缺口"), d("激励错位"), d("风险厌恶")],
        },
        {
          label: "主体",
          details: [d("用户"), d("团队"), d("组织"), d("市场"), d("社会")],
        },
        {
          label: "时间",
          details: [d("即时"), d("短期"), d("长期"), d("演化")],
        },
        {
          label: "证据",
          details: [d("事实"), d("概率"), d("假设"), d("案例")],
        },
      ];

    case "约束":
      return [
        {
          label: "成本",
          details: [
            d("人力成本"),
            d("时间成本"),
            d("沟通成本"),
            d("机会成本"),
            d("沉没成本"),
            d("边际成本"),
          ],
        },
        {
          label: "资源",
          details: [
            d("预算"),
            d("工具"),
            d("人力"),
            d("数据"),
            d("算力"),
            d("时间窗口"),
          ],
        },
        {
          label: "法规",
          details: [
            d("合规"),
            d("数据安全"),
            d("隐私"),
            d("知识产权"),
            d("行业监管"),
          ],
        },
        {
          label: "伦理",
          details: [
            d("隐私"),
            d("公平"),
            d("透明"),
            d("可解释"),
            d("责任归属"),
            d("偏见", ["数据偏见", "群体偏见", "评价偏见"]),
          ],
        },
        {
          label: "场景",
          details: [
            d("远程"),
            d("线下"),
            d("混合"),
            d("危机"),
            d("日常"),
            d("跨文化"),
          ],
        },
        {
          label: "能力",
          details: [
            d("技能"),
            d("管理"),
            d("学习曲线"),
            d("组织能力"),
            d("技术能力"),
          ],
        },
        {
          label: "利益相关者",
          details: [
            d("用户"),
            d("员工"),
            d("管理层"),
            d("客户"),
            d("监管"),
            d("社区"),
          ],
        },
        {
          label: "风险",
          details: [
            d("技术风险"),
            d("市场风险"),
            d("执行风险"),
            d("声誉风险"),
            d("合规风险"),
          ],
        },
      ];

    case "转化":
      return [
        {
          label: "属性",
          details: [
            d("成本"),
            d("体验"),
            d("信任"),
            d("速度"),
            d("质量"),
            d("灵活性"),
          ],
        },
        {
          label: "价值",
          details: [
            d("效率"),
            d("创新"),
            d("风险降低"),
            d("收入"),
            d("品牌"),
            d("学习"),
          ],
        },
        {
          label: "路径",
          details: [
            d("直接"),
            d("间接"),
            d("分阶段"),
            d("平台化"),
            d("服务化"),
          ],
        },
        {
          label: "条件",
          details: [d("资源"), d("能力"), d("时机"), d("合作方")],
        },
        {
          label: "主体",
          details: [d("用户"), d("团队"), d("组织"), d("市场"), d("社会")],
        },
        {
          label: "时间",
          details: [d("即时"), d("短期"), d("长期"), d("演化")],
        },
        {
          label: "证据",
          details: [d("案例"), d("试点"), d("数据"), d("假设")],
        },
      ];

    case "组合":
      return [
        {
          label: "功能",
          details: [d("互补"), d("叠加"), d("替代"), d("增强"), d("冲突")],
        },
        {
          label: "场景",
          details: [d("新场景"), d("旧场景"), d("跨界场景"), d("紧急场景")],
        },
        {
          label: "产品形态",
          details: [d("原型"), d("服务"), d("平台"), d("工具"), d("内容")],
        },
        {
          label: "用户",
          details: [d("个人"), d("团队"), d("组织"), d("开发者"), d("消费者")],
        },
        {
          label: "价值",
          details: [d("效率"), d("体验"), d("成本"), d("收入"), d("壁垒")],
        },
        {
          label: "风险",
          details: [
            d("复杂度"),
            d("维护成本"),
            d("依赖", ["技术依赖", "供应商依赖", "平台依赖"]),
            d("合规"),
          ],
        },
        {
          label: "条件",
          details: [d("接口"), d("数据"), d("流程"), d("组织协同")],
        },
      ];

    case "对立/张力":
      return [
        {
          label: "冲突类型",
          details: [d("目标冲突"), d("资源冲突"), d("价值冲突"), d("时间冲突")],
        },
        {
          label: "制衡",
          details: [d("相互约束"), d("检查与平衡"), d("替代"), d("互补")],
        },
        {
          label: "强度",
          details: [d("弱张力"), d("强冲突"), d("不可调和"), d("可转化")],
        },
        {
          label: "条件",
          details: [d("何时缓和"), d("何时激化"), d("触发事件"), d("边界")],
        },
        {
          label: "主体",
          details: [d("用户"), d("团队"), d("组织"), d("市场"), d("社会")],
        },
        {
          label: "时间",
          details: [d("即时"), d("短期"), d("长期"), d("演化")],
        },
        {
          label: "解决路径",
          details: [
            d("分离"),
            d("折中"),
            d("重构", ["目标重构", "边界重构", "角色重构"]),
            d("升级"),
            d("退出"),
          ],
        },
      ];

    case "尺度映射":
      return [
        {
          label: "层级",
          details: [d("个体"), d("团队"), d("组织"), d("行业"), d("社会"), d("生态")],
        },
        {
          label: "方向",
          details: [d("向上"), d("向下"), d("双向"), d("第三因素驱动")],
        },
        {
          label: "机制",
          details: [d("同构"), d("涌现"), d("传导"), d("放大"), d("衰减")],
        },
        {
          label: "边界",
          details: [d("成立条件"), d("失效条件"), d("尺度差异")],
        },
        {
          label: "主体",
          details: [d("用户"), d("组织"), d("技术"), d("市场"), d("社会")],
        },
        {
          label: "证据",
          details: [d("案例"), d("数据"), d("类比"), d("假设")],
        },
        {
          label: "用途",
          details: [d("解释"), d("预测"), d("设计"), d("决策")],
        },
      ];

    default:
      return genericDimensions(aTitle, bTitle);
  }
}
